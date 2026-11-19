import { failureJournal } from "./diagnostics.js";
import defaults from "../../config/candidate-service.json" with { type: "json" };
import { createHmac, timingSafeEqual } from "node:crypto";
import { dispatcher } from "../ingestion/http.js";
export class CandidateError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function candidateClient(options = {}) {
  const env = options.env || process.env;
  const url = (env.SUPABASE_URL || defaults.supabaseUrl).replace(/\/$/, "");
  const publicKey =
    env.SUPABASE_PUBLISHABLE_KEY ||
    env.SUPABASE_ANON_KEY ||
    defaults.publishableKey;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const siteUrl = (env.PUBLIC_SITE_URL || defaults.siteUrl).replace(/\/$/, "");
  const parsed = new URL(url),
    site = new URL(siteUrl);
  if (
    parsed.protocol !== "https:" ||
    !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) ||
    parsed.pathname !== "/" ||
    parsed.username ||
    parsed.password
  )
    throw new Error("Invalid Supabase project URL");
  if (
    site.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(site.hostname)
  )
    throw new Error("Invalid public site URL");
  const fetcher = options.fetcher || fetch;
  const failures = failureJournal(options.onFailure);
  async function call(
    path,
    { method = "GET", body, token, admin = false, headers = {} } = {},
  ) {
    const key = admin ? serviceKey : publicKey;
    if (!key)
      throw new CandidateError("Service temporairement indisponible.", 503);
    let response;
    try {
      response = await fetcher(url + path, {
        method,
        dispatcher,
        signal: AbortSignal.timeout(12000),
        headers: {
          apikey: key,
          ...(token
            ? { Authorization: `Bearer ${token}` }
            : admin && key.startsWith("eyJ")
              ? { Authorization: `Bearer ${key}` }
              : {}),
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      failures.record(path, null, null);
      throw new CandidateError(
        "Le service des comptes est momentanément inaccessible.",
        503,
      );
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      /* DELETE or empty response */
    }
    if (!response.ok) {
      // Never expose provider error bodies, tokens, recipient addresses or DB details.
      const status = response.status;
      const failure = failures.record(path, status, data);
      if (failure.category === "email_delivery")
        throw new CandidateError(
          "L’e-mail de confirmation ou de récupération n’a pas pu être envoyé. Réessayez plus tard.",
          503,
        );
      if (
        failure.category === "credentials" ||
        failure.category === "registration_disabled"
      )
        throw new CandidateError(
          "Les inscriptions sont momentanément indisponibles.",
          503,
        );
      if (status === 429)
        throw new CandidateError("Trop de demandes. Réessayez plus tard.", 429);
      if ([401, 403].includes(status))
        throw new CandidateError("Connexion requise ou accès refusé.", status);
      if (status === 404 || data?.code === "PT404")
        throw new CandidateError("Élément introuvable.", 404);
      if (status === 409 || data?.code === "PT409")
        throw new CandidateError(
          "Cet élément a déjà été modifié. Actualisez la page.",
          409,
        );
      if (status >= 500)
        throw new CandidateError(
          "Le service des comptes est momentanément indisponible.",
          503,
        );
      if (path.startsWith("/auth/"))
        throw new CandidateError(
          "Informations incorrectes, lien expiré ou adresse non confirmée.",
          400,
        );
      throw new CandidateError(
        "La demande ne peut pas être enregistrée.",
        status >= 500 ? 503 : 400,
      );
    }
    return data;
  }
  const rest = (path, options) => call("/rest/v1/" + path, options);
  const rpc = (name, body, options = {}) =>
    rest("rpc/" + name, { ...options, method: "POST", body });
  async function all(path, options) {
    const out = [];
    for (let offset = 0; ; offset += 500) {
      const page = await rest(
        path + (path.includes("?") ? "&" : "?") + "limit=500&offset=" + offset,
        options,
      );
      out.push(...page);
      if (page.length < 500) return out;
    }
  }
  const unsubscribeToken = (id) =>
    createHmac("sha256", serviceKey)
      .update("offres-fraiches:unsubscribe:" + id)
      .digest("base64url");
  const validUnsubscribe = (id, token) => {
    const a = Buffer.from(unsubscribeToken(id)),
      b = Buffer.from(String(token));
    return (
      Boolean(serviceKey) && a.length === b.length && timingSafeEqual(a, b)
    );
  };
  return {
    call,
    rest,
    rpc,
    all,
    env,
    siteUrl,
    unsubscribeToken,
    validUnsubscribe,
    hasServiceKey: Boolean(serviceKey),
    diagnostics: failures.read,
  };
}
