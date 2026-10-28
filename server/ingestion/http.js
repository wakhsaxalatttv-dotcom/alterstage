import { EnvHttpProxyAgent } from "undici";
import { lookup } from "node:dns";
import ipaddr from "ipaddr.js";
import { safeUrl } from "../domain.js";
export const publicAddress = (address) => {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
};
// Direct connections pin validated DNS answers. An explicit environment proxy retains its supported egress route.
export const dispatcher = new EnvHttpProxyAgent({
  connect: {
    lookup(hostname, options, callback) {
      lookup(hostname, { all: true }, (error, addresses) => {
        if (error) return callback(error);
        if (
          !addresses.length ||
          addresses.some((a) => !publicAddress(a.address))
        )
          return callback(new Error("Destination non publique refusée"));
        const selected = options.family
          ? addresses.filter((a) => a.family === options.family)
          : addresses;
        if (!selected.length)
          return callback(new Error("Adresse indisponible"));
        callback(
          null,
          options.all ? selected : selected[0].address,
          options.all ? undefined : selected[0].family,
        );
      });
    },
  },
});
export async function fetchFeed(source) {
  const url = safeUrl(source.url);
  if (!url || !source.allowedHosts?.includes(new URL(url).hostname))
    throw new Error("URL de source non autorisée");
  const parsedUrl = new URL(url);
  const managedLba =
    source.kind === "lba" &&
    parsedUrl.hostname === "api.apprentissage.beta.gouv.fr" &&
    parsedUrl.pathname === "/api/job/v1/search";
  // This fixed government API uses the platform's authenticated egress sidecar.
  // Its target DNS is resolved by that sidecar; local DNS can intentionally be private.
  if (
    !managedLba &&
    ["https_proxy", "HTTPS_PROXY", "http_proxy", "HTTP_PROXY"].some(
      (name) => process.env[name],
    )
  ) {
    // A proxy resolves CONNECT targets itself; check the destination locally too, without logging proxy credentials.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Résolution DNS trop lente")),
        5000,
      );
      lookup(new URL(url).hostname, { all: true }, (error, addresses) => {
        clearTimeout(timer);
        if (
          error ||
          !addresses.length ||
          addresses.some((a) => !publicAddress(a.address))
        )
          reject(new Error("Destination non publique ou indisponible"));
        else resolve();
      });
    });
  }
  const headers = {
    Accept:
      source.kind === "rss"
        ? "application/rss+xml, application/atom+xml, application/xml"
        : "application/json",
  };
  if (source.tokenEnv) {
    const token = process.env[source.tokenEnv];
    if (!token) throw new Error("Identifiant de source absent");
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch(url, {
    headers,
    dispatcher,
    redirect: "manual",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error("Réponse distante indisponible");
  const type = response.headers.get("content-type") || "";
  if (!(source.kind === "rss" ? /xml|rss|atom/ : /json/).test(type))
    throw new Error("Format de flux inattendu");
  const chunks = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) throw new Error("Flux trop volumineux");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function closeFeedConnections() {
  await dispatcher.close();
}
