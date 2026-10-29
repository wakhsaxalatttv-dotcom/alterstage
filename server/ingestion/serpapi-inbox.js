import {
  analyzeSerpCandidate,
  automaticSerpOffer,
} from "./serpapi-analysis.js";
import { isBlockedSource } from "../../shared/source-policy.js";
import { createHash } from "node:crypto";
import { plainText, extractKeywords } from "../enrichment.js";
import { safeUrl, normalizeSubmission, ValidationError } from "../domain.js";
import { isTrainingEmployer } from "../../shared/employer-policy.js";
import { isRecentPublication } from "../../shared/freshness.js";
const originalLink = (value) => {
  const url = safeUrl(value);
  if (!url) return null;
  const host = new URL(url).hostname;
  return /(^|\.)(google\.[a-z.]+|serpapi\.com|bing\.com)$/.test(host)
    ? null
    : url;
};
export function parseSerpCandidate(job, now = new Date().toISOString()) {
  if (!job || typeof job !== "object" || isBlockedSource(job)) return null;
  const title = plainText(job.title || job.job_title, 180);
  const companyName = plainText(job.company_name, 120);
  if (
    !title ||
    !companyName ||
    isTrainingEmployer(companyName) ||
    !/\b(stage|stagiaire|internship|alternance|alternant\w*|apprentissage|apprentice\w*)\b/i.test(
      title,
    ) ||
    /\b(CDI|freelance)\b/i.test(title)
  )
    return null;
  const sourceUrl =
    originalLink(job.source_link) ||
    (Array.isArray(job.apply_options)
      ? job.apply_options.map((o) => originalLink(o?.link)).find(Boolean)
      : null);
  if (!sourceUrl) return null;
  const description = plainText(job.description, 12000);
  if (!description) return null;
  // Relative snippets are evidence to consult, never manufactured exact publication dates.
  const extensions = Array.isArray(job.extensions) ? job.extensions : [];
  const explicitExtension = extensions
    .filter((v) => typeof v === "string")
    .map(
      (v) =>
        v.match(
          /^(?:(?:publiée?|publication|posted)\s*(?:le|on|:)?)?\s*(\d{4}-\d{2}-\d{2})$/i,
        )?.[1],
    )
    .find(Boolean);
  const detectedDate = job.detected_extensions?.posted_at;
  const date =
    typeof detectedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(detectedDate)
      ? detectedDate
      : explicitExtension || detectedDate;
  const publishedAt =
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date) &&
    isRecentPublication(date, Date.parse(now))
      ? date.slice(0, 10)
      : null;
  if (
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(date) &&
    !publishedAt
  )
    return null;
  const location = plainText(job.location, 200);
  const identity = [title, companyName, location, sourceUrl]
    .map((s) => s.toLowerCase().trim())
    .join("|");
  return {
    id: createHash("sha256").update(identity).digest("hex"),
    title,
    companyName,
    location,
    description,
    sourceUrl,
    applicationUrl: sourceUrl,
    publishedAt,
    sourcePublishedAt: publishedAt ? date : null,
    publicationText: plainText(
      [date, ...(Array.isArray(job.extensions) ? job.extensions : [])]
        .filter((v) => typeof v === "string")
        .join(" · "),
      500,
    ),
    via: plainText(job.via, 200),
    analysis: {
      technologies: extractKeywords(description).technologies,
      publicationConfirmed: false,
      requiresReview: [
        ...(publishedAt ? [] : ["Date de publication source manquante"]),
        "Région française, domaine et contrat à confirmer",
        "Identité de l’employeur et droits de réutilisation à contrôler",
      ],
    },
    firstRetrievedAt: now,
    lastRetrievedAt: now,
  };
}
export class SerpApiInbox {
  constructor(store) {
    this.store = store;
    this.db = store.db;
    this.db.exec(
      `CREATE TABLE IF NOT EXISTS serpapi_candidates(id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'pending', retrieved_at TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS serpapi_candidates_status ON serpapi_candidates(status,retrieved_at);`,
    );
  }
  excludeBlocked() {
    let withdrawn = 0;
    this.store.transaction(() => {
      for (const row of this.db
        .prepare(
          "SELECT id,payload FROM serpapi_candidates WHERE status='pending'",
        )
        .all()) {
        if (isBlockedSource(JSON.parse(row.payload))) {
          this.db
            .prepare(
              "UPDATE serpapi_candidates SET status='rejected' WHERE id=?",
            )
            .run(row.id);
          withdrawn++;
        }
      }
    });
    return withdrawn;
  }
  list() {
    this.excludeBlocked();
    return this.db
      .prepare(
        "SELECT payload FROM serpapi_candidates WHERE status='pending' AND retrieved_at>=? ORDER BY retrieved_at DESC LIMIT 100",
      )
      .all(new Date(Date.now() - 45 * 86400000).toISOString())
      .map((r) => JSON.parse(r.payload));
  }
  stage(jobs) {
    let created = 0,
      duplicate = 0,
      excluded = 0;
    this.store.transaction(() => {
      for (const job of jobs.slice(0, 100)) {
        const candidate = parseSerpCandidate(job);
        if (!candidate) {
          excluded++;
          continue;
        }
        const result = this.db
          .prepare(
            "INSERT OR IGNORE INTO serpapi_candidates(id,retrieved_at,payload) VALUES(?,?,?)",
          )
          .run(
            candidate.id,
            candidate.firstRetrievedAt,
            JSON.stringify(candidate),
          );
        if (result.changes) created++;
        else duplicate++;
      }
    });
    return { created, duplicate, excluded };
  }
  async ingestAutomatically(jobs, resolveLocation) {
    const report = {
      created: 0,
      updated: 0,
      unchanged: 0,
      duplicate: 0,
      excluded: 0,
      deferred: 0,
      published: 0,
      invalid: 0,
      reasons: {},
    };
    const reason = (key) =>
      (report.reasons[key] = (report.reasons[key] || 0) + 1);
    for (const job of jobs.slice(0, 100)) {
      const candidate = parseSerpCandidate(job);
      if (!candidate) {
        report.excluded++;
        reason(isBlockedSource(job) ? "meteojob" : "ineligible_source_record");
        continue;
      }
      const previous = this.db
        .prepare("SELECT status,payload FROM serpapi_candidates WHERE id=?")
        .get(candidate.id);
      if (previous && ["rejected", "submitted"].includes(previous.status)) {
        report.excluded++;
        reason("editorial_decision_preserved");
        continue;
      }
      if (previous)
        candidate.firstRetrievedAt = JSON.parse(
          previous.payload,
        ).firstRetrievedAt;
      const analysis = analyzeSerpCandidate(candidate);
      let location = null;
      if (!analysis.reasons.length) {
        try {
          location = await resolveLocation(candidate.location);
        } catch {
          /* A geocoding failure never authorizes publication. */
        }
        if (!location) analysis.reasons.push("french_location_not_established");
      }
      this.stage([job]);
      if (analysis.reasons.length) {
        report.deferred++;
        for (const r of analysis.reasons) reason(r);
        this.db
          .prepare(
            "UPDATE serpapi_candidates SET payload=? WHERE id=? AND status='pending'",
          )
          .run(
            JSON.stringify({
              ...candidate,
              analysis: {
                ...candidate.analysis,
                domain: analysis.domain,
                contracts: analysis.contracts,
                requiresReview: analysis.reasons,
              },
            }),
            candidate.id,
          );
        continue;
      }
      let offer;
      try {
        offer = automaticSerpOffer(candidate, analysis, location);
      } catch {
        offer = null;
      }
      if (!offer) {
        report.deferred++;
        reason("normalization_failed");
        continue;
      }
      const result = await this.store.ingest(offer);
      if (Object.hasOwn(report, result)) report[result]++;
      const row = this.db
        .prepare("SELECT id FROM offers WHERE source_id=? AND external_id=?")
        .get(offer.sourceId, offer.externalId);
      if (row && (await this.store.getPublic(row.id))) report.published++;
      this.db
        .prepare(
          "UPDATE serpapi_candidates SET status=? WHERE id=? AND status!='rejected'",
        )
        .run(
          result === "duplicate"
            ? "matched"
            : result === "invalid"
              ? "pending"
              : "published",
          candidate.id,
        );
    }
    return report;
  }
  reject(id) {
    if (
      !this.db
        .prepare(
          "UPDATE serpapi_candidates SET status='rejected' WHERE id=? AND status='pending'",
        )
        .run(id).changes
    )
      throw new ValidationError("Résultat introuvable ou déjà traité.");
    return { status: "rejected" };
  }
  async submit(id, body) {
    const row = this.db
      .prepare(
        "SELECT payload FROM serpapi_candidates WHERE id=? AND status='pending'",
      )
      .get(id);
    if (!row) throw new ValidationError("Résultat introuvable ou déjà traité.");
    const candidate = JSON.parse(row.payload);
    if (isBlockedSource(candidate))
      throw new ValidationError("Source Meteojob exclue.");
    if (
      body.sourceDateChecked !== true ||
      !isRecentPublication(body.publishedAt)
    )
      throw new ValidationError(
        "Confirmez la date sur la source originale : publication de 45 jours maximum requise.",
      );
    const offer = normalizeSubmission(
      {
        ...body,
        origin: "editorial",
        publicEmail: "",
        contactProvenance: "",
        contactConsent: false,
      },
      { allowOlderActiveSource: true },
    );
    offer.sourceId = "serpapi-google-jobs";
    offer.sourceName = "Google Jobs via SerpApi";
    offer.source = "Google Jobs via SerpApi — validation en attente";
    offer.firstRetrievedAt = candidate.firstRetrievedAt;
    const result = this.store.transaction(() => {
      this.store.writeOffer(offer);
      this.db
        .prepare("UPDATE serpapi_candidates SET status='submitted' WHERE id=?")
        .run(id);
      return { id: offer.id, status: "pending" };
    });
    return result;
  }
}
