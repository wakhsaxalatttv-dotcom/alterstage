import {
  analyzeSerpCandidate,
  automaticSerpOffer,
} from "./serpapi-analysis.js";
import { isBlockedSource } from "../../shared/source-policy.js";
import { createHash } from "node:crypto";
import { plainText, extractKeywords } from "../enrichment.js";
import { safeUrl, normalizeSubmission, ValidationError } from "../domain.js";
import { isTrainingEmployer } from "../../shared/employer-policy.js";
import {
  isRecentPublication,
  relativePublicationWindow,
  publicationIndex,
} from "../../shared/freshness.js";
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
  const contractText = plainText(
    [
      title,
      job.job_title,
      job.detected_extensions?.schedule_type,
      ...(Array.isArray(job.extensions) ? job.extensions : []),
    ]
      .filter((v) => typeof v === "string")
      .join(" · "),
    1000,
  );
  if (
    !title ||
    !companyName ||
    isTrainingEmployer(companyName) ||
    /\b(CDI|freelance)\b/i.test(contractText)
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
  const relativeText = [detectedDate, ...extensions].find((value) =>
    relativePublicationWindow(value, now),
  );
  const publicationEvidence =
    !publishedAt && relativeText
      ? { kind: "relative", text: relativeText, observedAt: now }
      : null;
  const location = plainText(job.location, 200);
  const identity = [title, companyName, location, sourceUrl]
    .map((s) => s.toLowerCase().trim())
    .join("|");
  return {
    id: createHash("sha256").update(identity).digest("hex"),
    title,
    contractText,
    companyName,
    location,
    description,
    sourceUrl,
    applicationUrl: sourceUrl,
    publishedAt,
    publicationEvidence,
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
export function serpExclusionReason(job) {
  if (!job || typeof job !== "object") return "invalid_source_record";
  if (isBlockedSource(job)) return "meteojob";
  if (!plainText(job.title || job.job_title, 180))
    return "source_title_missing";
  if (!plainText(job.company_name, 120)) return "source_employer_missing";
  if (isTrainingEmployer(job.company_name)) return "training_employer";
  const contractText = [
    job.title,
    job.detected_extensions?.schedule_type,
    ...(Array.isArray(job.extensions) ? job.extensions : []),
  ].join(" ");
  if (/\b(CDI|freelance)\b/i.test(contractText)) return "ineligible_contract";
  if (!plainText(job.description)) return "source_description_missing";
  if (
    !originalLink(job.source_link) &&
    !(
      Array.isArray(job.apply_options) &&
      job.apply_options.some((o) => originalLink(o?.link))
    )
  )
    return "source_link_missing";
  return "publication_missing_or_outside_45_days";
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
  async ingestAutomatically(jobs, resolveLocation, { observedAt } = {}) {
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
      const candidate = parseSerpCandidate(
        job,
        observedAt || new Date().toISOString(),
      );
      if (!candidate) {
        report.excluded++;
        reason(serpExclusionReason(job));
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
      if (previous) {
        const old = JSON.parse(previous.payload);
        candidate.firstRetrievedAt = old.firstRetrievedAt;
        if (
          candidate.publicationEvidence &&
          publicationIndex({ ...old, sourceId: "serpapi-google-jobs" }) &&
          Date.parse(
            publicationIndex({ ...old, sourceId: "serpapi-google-jobs" }),
          ) <=
            Date.parse(
              publicationIndex({
                ...candidate,
                sourceId: "serpapi-google-jobs",
              }),
            )
        ) {
          candidate.publishedAt = old.publishedAt || null;
          candidate.sourcePublishedAt = old.sourcePublishedAt || null;
          candidate.publicationEvidence = old.publishedAt
            ? null
            : old.publicationEvidence;
        }
      }
      const analysis = analyzeSerpCandidate(candidate);
      let location = null;
      if (!analysis.reasons.length) {
        try {
          if (typeof resolveLocation.inspect === "function") {
            const inspected = await resolveLocation.inspect(
              candidate.location,
              { countryContext: "FR" },
            );
            location = inspected.location;
            if (!location && inspected.reason)
              analysis.reasons.push(inspected.reason);
          } else
            location = await resolveLocation(candidate.location, {
              countryContext: "FR",
            });
        } catch {
          /* A geocoding failure never authorizes publication. */
        }
        if (!location) analysis.reasons.push("french_location_not_established");
      }
      this.stage([job]);
      this.db
        .prepare(
          "UPDATE serpapi_candidates SET payload=? WHERE id=? AND status NOT IN ('rejected','submitted')",
        )
        .run(JSON.stringify(candidate), candidate.id);
      if (analysis.reasons.length) {
        const existing = this.db
          .prepare(
            "SELECT payload FROM offers WHERE source_id='serpapi-google-jobs' AND external_id=?",
          )
          .get(candidate.id);
        if (existing) {
          const offer = JSON.parse(existing.payload);
          if (offer.moderationStatus === "approved" && !offer.lastVerifiedAt) {
            offer.moderationStatus = "pending";
            this.store.transaction(() => this.store.writeOffer(offer));
          }
        }
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
        this.db
          .prepare(
            "UPDATE serpapi_candidates SET payload=? WHERE id=? AND status='pending'",
          )
          .run(
            JSON.stringify({
              ...candidate,
              analysis: {
                ...candidate.analysis,
                requiresReview: ["normalization_failed"],
              },
            }),
            candidate.id,
          );
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
  async reanalyzeSaved(resolveLocation) {
    const total = {
      published: 0,
      deferred: 0,
      excluded: 0,
      created: 0,
      updated: 0,
      duplicate: 0,
      unchanged: 0,
    };
    const rows = this.db
      .prepare(
        "SELECT payload FROM serpapi_candidates WHERE status='pending' ORDER BY retrieved_at DESC LIMIT 100",
      )
      .all();
    for (const row of rows) {
      const candidate = JSON.parse(row.payload);
      const observedAt =
        candidate.lastRetrievedAt || candidate.firstRetrievedAt;
      if (
        !Number.isFinite(Date.parse(observedAt)) ||
        Date.parse(observedAt) > Date.now()
      )
        continue;
      const report = await this.ingestAutomatically(
        [
          {
            title: candidate.title,
            company_name: candidate.companyName,
            location: candidate.location,
            description: candidate.description,
            source_link: candidate.sourceUrl,
            via: candidate.via,
            extensions: (candidate.publicationText || "").split(" · "),
            detected_extensions: {
              posted_at:
                candidate.sourcePublishedAt ||
                candidate.publishedAt ||
                undefined,
              schedule_type: candidate.contractText || undefined,
            },
          },
        ],
        resolveLocation,
        { observedAt },
      );
      for (const key of Object.keys(total)) total[key] += report[key] || 0;
    }
    return total;
  }
  diagnostics() {
    return this.db
      .prepare(
        "SELECT payload FROM serpapi_candidates WHERE status='pending' ORDER BY retrieved_at DESC LIMIT 10",
      )
      .all()
      .map((row) => {
        const c = JSON.parse(row.payload);
        return {
          title: plainText(c.title, 180),
          companyName: plainText(c.companyName, 120),
          location: plainText(c.location, 200),
          publicationText: plainText(c.publicationText, 500),
          contractText: plainText(c.contractText, 500),
          observedAt: c.lastRetrievedAt || c.firstRetrievedAt,
          reasons: (c.analysis?.requiresReview || [])
            .filter((v) => typeof v === "string")
            .slice(0, 10),
        };
      });
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
