import { createHash } from "node:crypto";
import { dispatcher } from "./http.js";
import { romeDomains } from "./lba.js";
import { regions } from "../../src/domain.js";
import { isRecentPublication } from "../../shared/freshness.js";
import { plainText } from "../enrichment.js";
import { safeUrl } from "../domain.js";
export const FT_SEARCH_URL =
  "https://api.francetravail.io/partenaire/offresdemploi/v2/offres/search";
export const FT_TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire";
export const franceTravailSource = {
  id: "france-travail",
  name: "France Travail",
  kind: "france-travail",
  url: FT_SEARCH_URL,
  allowedHosts: ["api.francetravail.io"],
  enabled: true,
  authorized: true,
  publishUnverified: true,
  licenseUrl:
    "https://francetravail.io/produits-partages/catalogue/offres-emploi",
  authorizationRef:
    "API Offres d’emploi, accès partenaire et conditions de réutilisation acceptées par le responsable.",
};
export function franceTravailConfiguration(env = process.env) {
  return {
    requested: Boolean(
      env.FRANCE_TRAVAIL_CLIENT_ID || env.FRANCE_TRAVAIL_CLIENT_SECRET,
    ),
    configured: Boolean(
      env.FRANCE_TRAVAIL_CLIENT_ID?.trim() &&
        env.FRANCE_TRAVAIL_CLIENT_SECRET?.trim(),
    ),
    enabled: env.FRANCE_TRAVAIL_ENABLED !== "false",
  };
}
export class FranceTravailError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}
const failure = (code, message) => new FranceTravailError(code, message);
async function jsonResponse(response) {
  const reader = response.body?.getReader();
  if (!reader)
    throw failure("invalid_response", "France Travail : réponse vide.");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024)
        throw failure(
          "invalid_response",
          "France Travail : réponse trop volumineuse.",
        );
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw failure(
        "invalid_response",
        "France Travail : format de réponse inattendu.",
      );
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
// The connector can only call these two fixed HTTPS endpoints; secrets never enter source files or URLs.
export function createFranceTravailClient({
  env = process.env,
  fetcher = fetch,
  now = Date.now,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  let cachedToken = null;
  let tokenExpiresAt = 0;
  async function request(url, options) {
    try {
      return await fetcher(url, {
        ...options,
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw failure(
        "network",
        "France Travail : connexion indisponible. Vérifier le réseau du serveur.",
      );
    }
  }
  async function token() {
    const config = franceTravailConfiguration(env);
    if (!config.configured)
      throw failure(
        "not_configured",
        "France Travail : source non configurée, identifiant client ou secret absent.",
      );
    if (cachedToken && now() < tokenExpiresAt) return cachedToken;
    const response = await request(FT_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.FRANCE_TRAVAIL_CLIENT_ID.trim(),
        client_secret: env.FRANCE_TRAVAIL_CLIENT_SECRET.trim(),
        scope: "api_offresdemploiv2 o2dsoffre",
      }),
    });
    if (!response.ok)
      throw failure(
        "authentication",
        "France Travail : authentification refusée. Vérifier les deux identifiants et l’accès à l’API Offres d’emploi.",
      );
    const data = await jsonResponse(response);
    if (
      typeof data.access_token !== "string" ||
      !data.access_token ||
      !Number.isFinite(Number(data.expires_in)) ||
      Number(data.expires_in) <= 0
    )
      throw failure("authentication", "France Travail : jeton OAuth invalide.");
    cachedToken = data.access_token;
    tokenExpiresAt = now() + Math.max(0, Number(data.expires_in) - 60) * 1000;
    return cachedToken;
  }
  return {
    async collect() {
      const records = new Map(),
        romes = Object.keys(romeDomains);
      let truncated = false,
        requests = 0;
      const maxPages = Math.min(
        10,
        Math.max(1, Math.floor(Number(env.FRANCE_TRAVAIL_MAX_PAGES)) || 3),
      );
      for (let i = 0; i < romes.length; i += 3) {
        for (const keyword of ["alternance", "apprentissage", "stage"]) {
          for (let page = 0; page < maxPages; page++) {
            const url = new URL(FT_SEARCH_URL);
            url.search = new URLSearchParams({
              romeCode: romes.slice(i, i + 3).join(","),
              motsCles: keyword,
              range: `${page * 150}-${page * 150 + 149}`,
              sort: "1",
            });
            await wait(200);
            let response = await request(url.href, {
              headers: {
                Accept: "application/json",
                Authorization: `Bearer ${await token()}`,
              },
            });
            requests++;
            if (response.status === 401) {
              cachedToken = null;
              response = await request(url.href, {
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${await token()}`,
                },
              });
            }
            if (response.status === 204) break;
            if (response.status === 429) {
              const delay = Math.min(
                10000,
                Math.max(
                  1000,
                  Number(response.headers.get("retry-after")) * 1000 || 2000,
                ),
              );
              await wait(delay);
              response = await request(url.href, {
                headers: {
                  Accept: "application/json",
                  Authorization: `Bearer ${await token()}`,
                },
              });
            }
            if (response.status === 204) break;
            if (!response.ok) {
              const code =
                response.status === 429
                  ? "rate_limited"
                  : response.status === 403
                    ? "access_denied"
                    : "api_error";
              throw failure(
                code,
                response.status === 429
                  ? "France Travail : quota atteint. Réessayer la collecte plus tard."
                  : response.status === 403
                    ? "France Travail : accès à l’API Offres d’emploi non autorisé pour cette application."
                    : "France Travail : recherche indisponible. Vérifier les droits et les paramètres API.",
              );
            }
            const data = await jsonResponse(response);
            if (!Array.isArray(data.resultats))
              throw failure(
                "invalid_response",
                "France Travail : liste des offres absente.",
              );
            for (const offer of data.resultats)
              if (typeof offer?.id === "string") records.set(offer.id, offer);
            const range = response.headers
              .get("content-range")
              ?.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+|\*)/);
            const more = range
              ? range[3] === "*" || Number(range[2]) + 1 < Number(range[3])
              : response.status === 206 && data.resultats.length >= 150;
            if (!more || !data.resultats.length) break;
            if (page + 1 === maxPages) truncated = true;
          }
        }
      }
      return JSON.stringify({
        resultats: [...records.values()],
        collection: { truncated, requests },
      });
    },
  };
}
let defaultClient;
export const fetchFranceTravail = () =>
  (defaultClient ||= createFranceTravailClient()).collect();
export function parseFranceTravail(body, now = Date.now()) {
  const data = typeof body === "string" ? JSON.parse(body) : body;
  if (!Array.isArray(data.resultats))
    throw failure("invalid_response", "France Travail : réponse invalide.");
  const records = [],
    exclusions = {
      old: 0,
      school: 0,
      contract: 0,
      outOfScope: 0,
      incomplete: 0,
    };
  for (const offer of data.resultats) {
    if (!offer || typeof offer !== "object") {
      exclusions.incomplete++;
      continue;
    }
    if (!isRecentPublication(offer.dateCreation, now)) {
      exclusions.old++;
      continue;
    }
    const employer = offer.entreprise;
    if (
      /^85/.test(offer.codeNAF || "") ||
      /\b(cfa|école|ecole|campus|centre de formation|organisme de formation)\b/i.test(
        employer?.nom || "",
      )
    ) {
      exclusions.school++;
      continue;
    }
    const nature = offer.natureContrat || "",
      type = offer.typeContratLibelle || "";
    // A keyword search is discovery only. Only structured contract labels authorize inclusion.
    const contract = /apprentiss|apprenti/i.test(nature)
      ? "Apprentissage"
      : /professionnalis/i.test(nature)
        ? "Contrat de professionnalisation"
        : /\bstage\b/i.test(type)
          ? "Stage"
          : null;
    if (!contract) {
      exclusions.contract++;
      continue;
    }
    const domain = romeDomains[offer.romeCode];
    if (!domain) {
      exclusions.outOfScope++;
      continue;
    }
    const location = offer.lieuTravail || {};
    const code = String(location.commune || location.codePostal || "");
    const department = code.startsWith("97")
      ? code.slice(0, 3)
      : code.startsWith("20")
        ? "2A"
        : code.slice(0, 2);
    const region =
      department === "2A" || department === "2B"
        ? "Corse"
        : Object.keys(regions).find((r) =>
            regions[r].split(" ").includes(department),
          );
    const city =
      typeof location.libelle === "string"
        ? location.libelle.replace(/^\d{2,3}\s*-\s*/, "").trim()
        : null;
    const sourceUrl = safeUrl(offer.origineOffre?.urlOrigine);
    if (
      !offer.id ||
      !employer?.nom ||
      !region ||
      !city ||
      !sourceUrl ||
      !offer.intitule ||
      !offer.description
    ) {
      exclusions.incomplete++;
      continue;
    }
    const identity =
      "ft-company:" +
      createHash("sha256")
        .update(employer.nom + "|" + code)
        .digest("hex")
        .slice(0, 20);
    // This is a local retention deadline, never a date attributed to the source.
    const retention = Math.min(
      Date.parse(offer.dateCreation.slice(0, 10)) + 46 * 864e5,
      now + 2 * 864e5,
    );
    records.push({
      externalId: offer.id,
      title: plainText(offer.intitule, 180),
      companyName: plainText(employer.nom, 120),
      companyWebsite: safeUrl(employer.url),
      companyIdentity: identity,
      companyDescription: plainText(employer.description || "", 2000),
      sector: plainText(offer.secteurActiviteLibelle || ""),
      sourceUrl,
      applicationUrl: safeUrl(offer.contact?.urlPostulation) || sourceUrl,
      city: plainText(city, 120),
      region,
      domain,
      contract,
      description: offer.description,
      education: (offer.formations || [])
        .map((f) => f.niveauLibelle)
        .filter(Boolean)
        .join(" · "),
      skills: (offer.competences || [])
        .map((c) => c.libelle)
        .filter(Boolean)
        .join("\n"),
      publishedAt: offer.dateCreation,
      sourceUpdatedAt: offer.dateActualisation,
      expiresAt: new Date(retention).toISOString().slice(0, 10),
      sourceExpiresAt: null,
      sourceStatus: "returned_by_api",
      sourcePartner: "France Travail",
      duration: offer.dureeContratLibelle || null,
    });
  }
  records.exclusions = exclusions;
  records.collection = data.collection || null;
  return records;
}
