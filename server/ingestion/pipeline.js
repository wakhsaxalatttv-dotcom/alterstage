import { lbaSource } from "./lba.js";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { normalizeSubmission, safeUrl } from "../domain.js";
import { plainText } from "../enrichment.js";
import { parseFeed } from "./connectors.js";
import { fetchFeed } from "./http.js";
export async function readSources(file = process.env.SOURCES_FILE) {
  if (!file)
    return process.env.LBA_API_KEY && process.env.LBA_ENABLED !== "false"
      ? [lbaSource]
      : [];
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(parsed) || parsed.length > 30)
    throw new Error("Configuration des sources invalide");
  const ids = new Set();
  for (const source of parsed) {
    if (!/^[a-z0-9-]{1,60}$/.test(source.id) || ids.has(source.id))
      throw new Error("Identifiants de source invalides ou dupliqués");
    if (
      source.enabled === true &&
      (!["json", "rss", "lba"].includes(source.kind) ||
        !safeUrl(source.url) ||
        !Array.isArray(source.allowedHosts) ||
        !source.allowedHosts.includes(new URL(source.url).hostname))
    )
      throw new Error("URL, format ou hôte autorisé de source invalide");
    if (source.tokenEnv && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(source.tokenEnv))
      throw new Error("Nom de variable source invalide");
    if (
      source.defaults &&
      (typeof source.defaults !== "object" || Array.isArray(source.defaults))
    )
      throw new Error("Valeurs structurées par défaut invalides");
    ids.add(source.id);
  }
  return parsed;
}
const iso = (value) => {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
};
export function normalizeRecord(
  record,
  source,
  now = new Date().toISOString(),
) {
  if (!record || typeof record !== "object")
    throw new Error("Annonce invalide");
  const publishedAt = iso(record.publishedAt);
  if (!publishedAt || Date.parse(publishedAt) > Date.parse(now))
    throw new Error("Date source absente ou future");
  // Only explicit structured company/location/contract fields are authoritative. Keywords remain suggestions.
  const input = {
    ...source.defaults,
    ...record,
    description: plainText(record.description),
    title: plainText(record.title, 180),
    publishedAt: publishedAt.slice(0, 10),
    expiresAt:
      record.expiresAt ||
      new Date(
        Math.min(
          Date.parse(publishedAt) + 30 * 86400000,
          Date.parse(now) + 30 * 86400000,
        ),
      )
        .toISOString()
        .slice(0, 10),
    publicEmail: "",
    contactProvenance: "",
    contactConsent: false,
    origin: "editorial",
    consent: true,
  };
  const trustedLba =
    source.kind === "lba" &&
    source.id === lbaSource.id &&
    safeUrl(source.url) &&
    new URL(source.url).hostname === "api.apprentissage.beta.gouv.fr" &&
    new URL(source.url).pathname === "/api/job/v1/search";
  const normalized = normalizeSubmission(input, {
    now,
    allowOlderActiveSource: trustedLba && source.includeOlderActive === true,
    allowMissingWebsite: trustedLba,
    companyIdentity: trustedLba ? record.companyIdentity : null,
  });
  const externalId = String(record.externalId || record.sourceUrl || "").slice(
    0,
    500,
  );
  if (!externalId) throw new Error("Identité source absente");
  const sourceUpdatedAt = iso(record.sourceUpdatedAt);
  const contentHash = createHash("sha256")
    .update(
      JSON.stringify({
        title: normalized.title,
        description: normalized.description,
        company: normalized.company,
        location: normalized.location,
        domain: normalized.domain,
        contract: normalized.contract,
        acceptedContracts: record.acceptedContracts || [normalized.contract],
        sourceExpiresAt: record.sourceExpiresAt || null,
        sourcePartner: record.sourcePartner || null,
        education: normalized.education,
        publishedAt,
        sourceUpdatedAt,
        expiresAt: normalized.expiresAt,
        sourceUrl: normalized.sourceUrl,
        applicationUrl: normalized.applicationUrl,
        skills: normalized.skills,
        missions: normalized.missions,
      }),
    )
    .digest("hex");
  return {
    ...normalized,
    acceptedContracts: trustedLba
      ? record.acceptedContracts || [normalized.contract]
      : [normalized.contract],
    sourceExpiresAt: record.sourceExpiresAt || null,
    sourcePartner: record.sourcePartner || null,
    sourceStatus: record.sourceStatus || null,
    sourcePolicyApproved: trustedLba && source.publishUnverified === true,
    origin: "feed",
    sourceId: source.id,
    sourceName: source.name || source.id,
    externalId,
    contentHash,
    sourcePublishedAt: publishedAt,
    sourceUpdatedAt,
    lastFetchedAt: now,
    updatedAt: now,
    source: `Flux autorisé · ${source.name || source.id}`,
    reuse: {
      licenseUrl: source.licenseUrl,
      authorizationRef: source.authorizationRef || null,
    },
  };
}
export class IngestionPipeline {
  constructor(store, { sources = readSources, fetcher = fetchFeed } = {}) {
    this.store = store;
    this.sources = sources;
    this.fetcher = fetcher;
    this.running = null;
  }
  async status() {
    try {
      const sources = await this.sources();
      return {
        running: Boolean(this.running),
        configured: sources.length > 0,
        sources: sources.map((s) => ({
          id: s.id,
          name: s.name || s.id,
          kind: s.kind,
          status:
            s.enabled !== true
              ? "disabled"
              : s.authorized !== true || !safeUrl(s.licenseUrl)
                ? "authorization_required"
                : "configured",
        })),
        runs: this.store.runs(),
      };
    } catch {
      return {
        running: Boolean(this.running),
        configured: false,
        sources: [],
        runs: this.store.runs(),
        error:
          "Configuration des sources illisible : vérifier SOURCES_FILE côté serveur.",
      };
    }
  }
  run() {
    if (!this.running)
      this.running = this.execute().finally(() => {
        this.running = null;
      });
    return this.running;
  }
  async execute() {
    const sources = await this.sources(),
      reports = [];
    for (const source of sources) {
      const report = {
        sourceId: source.id,
        startedAt: new Date().toISOString(),
        status: "skipped",
        created: 0,
        updated: 0,
        unchanged: 0,
        duplicate: 0,
        invalid: 0,
      };
      if (
        source.enabled === true &&
        source.authorized === true &&
        safeUrl(source.licenseUrl)
      ) {
        try {
          const records = parseFeed(source, await this.fetcher(source));
          if (records.exclusions) report.exclusions = records.exclusions;
          for (const record of records) {
            let offer;
            try {
              offer = normalizeRecord(record, source);
            } catch {
              report.invalid++;
              continue;
            }
            const result = await this.store.ingest(offer);
            report[result]++;
          }
          report.status = report.invalid ? "partial" : "success";
        } catch {
          report.status = "error";
          report.message =
            "Échec de connexion, de format ou de stockage. Vérifier la configuration, les droits et le réseau côté serveur.";
        }
      } else
        report.message =
          "Source désactivée ou autorisation de réutilisation non renseignée.";
      report.finishedAt = new Date().toISOString();
      this.store.recordRun(report);
      reports.push(report);
    }
    return {
      reports,
      message: sources.length
        ? "Collecte terminée. Les dépôts et flux génériques attendent une validation ; les offres LBA éligibles restent explicitement non vérifiées."
        : "Aucune source configurée. Aucun flux ni offre n’a été inventé.",
    };
  }
}
