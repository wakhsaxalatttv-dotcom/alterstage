import { isBlockedSource } from "../../shared/source-policy.js";
import { isTrainingEmployer } from "../../shared/employer-policy.js";
import { createHash } from "node:crypto";
import { dispatcher } from "./http.js";
import { franceTravailDomains } from "./france-travail-domains.js";
import { regions } from "../../src/domain.js";
import {
  publicationCutoff,
  isRecentPublication,
} from "../../shared/freshness.js";
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
const oauthDiagnostics = {
  invalid_client:
    "Identifiant client ou secret refusé. Recopier le couple client_id/client_secret de la même application dans Render.",
  invalid_scope:
    "Droits OAuth demandés non accordés. Vérifier que l’application est abonnée à l’API Offres d’emploi et autorisée pour api_offresdemploiv2 o2dsoffre.",
  unauthorized_client:
    "Application non autorisée pour cet accès. Vérifier son activation et son abonnement à l’API Offres d’emploi dans l’espace partenaire.",
  access_denied:
    "Accès refusé par France Travail. Vérifier l’autorisation de l’application dans l’espace partenaire.",
  invalid_request:
    "Requête OAuth refusée. Vérifier la configuration de l’application partenaire et le format de ses identifiants.",
  unsupported_grant_type:
    "Le serveur ne permet pas le flux client_credentials demandé pour cette application.",
  temporarily_unavailable:
    "Le service d’authentification France Travail est temporairement indisponible. Réessayer plus tard.",
};
async function oauthFailure(response) {
  let remoteCode;
  try {
    const body = await jsonResponse(response);
    // Only fixed standard codes may leave this boundary. Never log descriptions or arbitrary OAuth response fields.
    if (Object.hasOwn(oauthDiagnostics, body?.error)) remoteCode = body.error;
  } catch {
    /* Non-JSON responses still produce a safe HTTP-only diagnostic. */
  }
  const prefix = `France Travail : OAuth HTTP ${response.status}${remoteCode ? ` (${remoteCode})` : ""}. `;
  if (remoteCode)
    return failure("authentication", prefix + oauthDiagnostics[remoteCode]);
  if (response.status >= 300 && response.status < 400)
    return failure(
      "authentication",
      prefix +
        "Redirection du service d’authentification non suivie pour protéger les identifiants. Vérifier l’adresse OAuth officielle.",
    );
  if (response.status === 429)
    return failure(
      "rate_limited",
      prefix +
        "Quota du service d’authentification atteint. Réessayer plus tard.",
    );
  if (response.status >= 500)
    return failure(
      "network",
      prefix + "Service d’authentification indisponible. Réessayer plus tard.",
    );
  return failure(
    "authentication",
    prefix +
      "Authentification refusée. Vérifier le couple client_id/client_secret et l’abonnement de cette application à l’API Offres d’emploi.",
  );
}

// The connector can only call these two fixed HTTPS endpoints; secrets never enter source files or URLs.
export function createFranceTravailClient({
  env = process.env,
  fetcher = fetch,
  now = Date.now,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  readCursor = null,
  writeCursor = null,
} = {}) {
  let cachedToken = null;
  let romeCursor = 0;
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
        scope: `application_${env.FRANCE_TRAVAIL_CLIENT_ID.trim()} api_offresdemploiv2 o2dsoffre`,
      }),
    });
    if (!response.ok) throw await oauthFailure(response);
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
      const records = new Map();
      const allRomes = Object.keys(franceTravailDomains);
      const start =
        Math.max(0, Number(readCursor ? readCursor() : romeCursor) || 0) %
        allRomes.length;
      const romes = [...allRomes.slice(start), ...allRomes.slice(0, start)];
      const until = Math.floor(now() / 1000) * 1000;
      const since = Date.parse(publicationCutoff(until));
      const maxPages = Math.min(
        10,
        Math.max(1, Math.floor(Number(env.FRANCE_TRAVAIL_MAX_PAGES)) || 10),
      );
      const maxRequests = Math.min(
        5000,
        Math.max(
          1,
          Math.floor(Number(env.FRANCE_TRAVAIL_MAX_REQUESTS)) || 2000,
        ),
      );
      let requests = 0,
        partitions = 0,
        completedRomeCodes = 0,
        examined = 0;
      const filteredExclusions = {};
      const limitations = new Set();
      async function pageRequest(url) {
        if (requests >= maxRequests)
          throw failure(
            "request_budget",
            "France Travail : budget de requêtes atteint.",
          );
        requests++;
        await wait(200);
        return request(url, {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${await token()}`,
          },
        });
      }
      async function scan(rome, min, max) {
        partitions++;
        for (let page = 0; page < maxPages; page++) {
          const url = new URL(FT_SEARCH_URL);
          url.search = new URLSearchParams({
            romeCode: rome,
            minCreationDate: new Date(min).toISOString().replace(".000Z", "Z"),
            maxCreationDate: new Date(max).toISOString().replace(".000Z", "Z"),
            range: `${page * 150}-${page * 150 + 149}`,
            sort: "1",
          });
          let response = await pageRequest(url.href);
          if (response.status === 401) {
            cachedToken = null;
            response = await pageRequest(url.href);
          }
          if (response.status === 429) {
            await wait(
              Math.min(
                10000,
                Math.max(
                  1000,
                  Number(response.headers.get("retry-after")) * 1000 || 2000,
                ),
              ),
            );
            response = await pageRequest(url.href);
          }
          if (response.status === 204) return true;
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
          examined += data.resultats.length;
          const eligible = parseFranceTravail(
            { resultats: data.resultats },
            until,
          );
          for (const [reason, count] of Object.entries(eligible.exclusions))
            filteredExclusions[reason] =
              (filteredExclusions[reason] || 0) + count;
          const acceptedIds = new Set(
            eligible.map((offer) => offer.externalId),
          );
          for (const offer of data.resultats)
            if (typeof offer?.id === "string" && acceptedIds.has(offer.id))
              records.set(offer.id, offer);
          const range = response.headers
            .get("content-range")
            ?.match(/(\d+)\s*-\s*(\d+)\s*\/\s*(\d+|\*)/);
          const total = range && range[3] !== "*" ? Number(range[3]) : null;
          const more = range
            ? range[3] === "*" || Number(range[2]) + 1 < total
            : response.status === 206 && data.resultats.length >= 150;
          if (!more) return true;
          // Partition a crowded time window rather than silently losing records past the API range cap.
          if ((page === 0 && total > maxPages * 150) || page + 1 === maxPages) {
            const midpoint = Math.floor((min + max) / 2000) * 1000;
            if (midpoint <= min || midpoint >= max) {
              limitations.add("saturated_second");
              return false;
            }
            const left = await scan(rome, min, midpoint);
            const right = await scan(rome, midpoint, max);
            return left && right;
          }
          if (!data.resultats.length) {
            limitations.add("inconsistent_pagination");
            return false;
          }
        }
        return false;
      }
      try {
        for (const rome of romes) {
          if (await scan(rome, since, until)) completedRomeCodes++;
          romeCursor = (allRomes.indexOf(rome) + 1) % allRomes.length;
          if (writeCursor) writeCursor(romeCursor);
        }
      } catch (error) {
        // Keep fetched records on a quota/network interruption, but never report a completed collection.
        if (
          !(error instanceof FranceTravailError) ||
          (!records.size && error.code !== "request_budget") ||
          !["request_budget", "rate_limited", "network"].includes(error.code)
        )
          throw error;
        limitations.add(error.code);
      }
      return JSON.stringify({
        resultats: [...records.values()],
        collection: {
          truncated: limitations.size > 0 || completedRomeCodes < romes.length,
          requests,
          partitions,
          completedRomeCodes,
          totalRomeCodes: romes.length,
          nextRomeIndex: romeCursor,
          examined,
          filteredExclusions,
          since: new Date(since).toISOString(),
          until: new Date(until).toISOString(),
          limitations: [...limitations],
        },
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
    if (
      isBlockedSource({
        sourceUrl: offer.origineOffre?.urlOrigine,
        applicationUrl: offer.contact?.urlPostulation,
        apply_options: Array.isArray(offer.origineOffre?.partenaires)
          ? offer.origineOffre.partenaires.map((p) => ({
              title: p.nom,
              link: p.url,
            }))
          : [],
      })
    ) {
      exclusions.incomplete++;
      continue;
    }
    if (!isRecentPublication(offer.dateCreation, now)) {
      exclusions.old++;
      continue;
    }
    const employer = offer.entreprise;
    if (
      isTrainingEmployer(
        employer?.nom,
        offer.secteurActiviteLibelle,
        offer.codeNAF,
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
          : /alternance|alternant/i.test(nature + " " + type)
            ? "Alternance — type non précisé"
            : null;
    if (!contract) {
      exclusions.contract++;
      continue;
    }
    const domain = franceTravailDomains[offer.romeCode] || "Autres domaines";
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
