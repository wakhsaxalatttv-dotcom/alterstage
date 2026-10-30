import { publicOffer } from "./domain.js";
import { canonicalUrl } from "./store.js";
import { isBlockedSource } from "../shared/source-policy.js";
import { randomUUID } from "node:crypto";
import { ValidationError } from "./domain.js";
import { externalOffers } from "../shared/external-offers.js";
import { isRecentPublication } from "../shared/freshness.js";
import { reportReasons } from "../shared/reporting.js";
const text = (value, max, label) => {
  if (value == null) return "";
  if (typeof value !== "string" || value.length > max)
    throw new ValidationError(`${label} : texte trop long ou invalide.`);
  return value.trim();
};
export class Reports {
  constructor(store) {
    this.store = store;
  }
  references() {
    const hidden = new Set(
      this.store.db
        .prepare("SELECT id FROM hidden_references")
        .all()
        .map((row) => row.id),
    );
    const hiddenUrls = new Set();
    for (const row of this.store.db
      .prepare(
        "SELECT id,canonical_url FROM offers WHERE moderation IN ('withdrawn','rejected') OR status IN ('withdrawn','expired')",
      )
      .all()) {
      hidden.add(row.id);
      hiddenUrls.add(row.canonical_url);
    }
    const curated = externalOffers.filter(
      (offer) =>
        !hidden.has(offer.id) &&
        !hiddenUrls.has(canonicalUrl(offer.sourceUrl)) &&
        !isBlockedSource(offer) &&
        isRecentPublication(offer.publishedAt),
    );
    const live = this.store.db
      .prepare(
        "SELECT payload FROM offers WHERE moderation='approved' AND status NOT IN ('expired','withdrawn') ORDER BY published_at DESC LIMIT 200",
      )
      .all()
      .map((row) => publicOffer(JSON.parse(row.payload)))
      .filter(Boolean)
      .filter((o) => !hidden.has(o.id))
      .map((o) => ({
        ...o,
        sourceKind: "market",
        companyWebsite: o.company.website,
        summary: o.description,
        profile: (o.skills || []).join(" · "),
        companySummary: o.company.description || null,
        sourceName: o.sourceName || o.source,
        duration: o.duration || null,
      }));
    const seen = new Set();
    return [...curated, ...live].filter((o) => {
      const key = canonicalUrl(o.sourceUrl);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  async create(body) {
    const id = text(body.offerId, 180, "Annonce");
    if (!Object.hasOwn(reportReasons, body.reason))
      throw new ValidationError("Motif de signalement invalide.");
    const details = text(body.details, 1500, "Précisions");
    const reference = this.references().find((offer) => offer.id === id);
    const target = reference || (await this.store.getPublic(id));
    if (!target)
      throw new ValidationError("Cette annonce n’est plus disponible.");
    // L’identité et l’URL proviennent du serveur, jamais des champs du formulaire.
    const snapshot = {
      id: target.id,
      title: target.title,
      company: target.company.name,
      sourceUrl: target.sourceUrl,
    };
    const reportId = randomUUID();
    this.store.transaction(() =>
      this.store.db
        .prepare(
          `INSERT INTO offer_reports(id,offer_id,target_kind,reason,details,created_at,offer_snapshot) VALUES(?,?,?,?,?,?,?)`,
        )
        .run(
          reportId,
          id,
          reference && reference.sourceKind !== "market"
            ? "reference"
            : "catalogue",
          body.reason,
          details,
          new Date().toISOString(),
          JSON.stringify(snapshot),
        ),
    );
    return { id: reportId, status: "open" };
  }
  list(filters = {}) {
    const status = filters.status || "open";
    if (!["open", "resolved", "dismissed"].includes(status))
      throw new ValidationError("Statut de signalement invalide.");
    const page = Math.max(
        1,
        Math.min(100000, Number.parseInt(filters.page, 10) || 1),
      ),
      pageSize = 20;
    const total = this.store.db
      .prepare("SELECT count(*) AS total FROM offer_reports WHERE status=?")
      .get(status).total;
    const counts = { open: 0, resolved: 0, dismissed: 0 };
    for (const row of this.store.db
      .prepare("SELECT status,count(*) AS n FROM offer_reports GROUP BY status")
      .all())
      counts[row.status] = row.n;
    const reports = this.store.db
      .prepare(
        "SELECT * FROM offer_reports WHERE status=? ORDER BY created_at DESC,id LIMIT ? OFFSET ?",
      )
      .all(status, pageSize, (page - 1) * pageSize)
      .map(({ offer_snapshot, ...row }) => ({
        ...row,
        offer: JSON.parse(offer_snapshot),
      }));
    return {
      reports,
      counts,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / pageSize)),
      pageSize,
    };
  }
  review(id, body) {
    if (!["resolve", "dismiss", "withdraw"].includes(body.action))
      throw new ValidationError("Action de signalement invalide.");
    const note = text(body.note, 1000, "Note de modération");
    return this.store.transaction(() => {
      const report = this.store.db
        .prepare("SELECT * FROM offer_reports WHERE id=?")
        .get(id);
      if (!report) throw new ValidationError("Signalement introuvable.");
      if (report.status !== "open")
        throw new ValidationError("Ce signalement a déjà été traité.");
      const now = new Date().toISOString();
      if (body.action === "withdraw") {
        if (report.target_kind === "reference")
          this.store.db
            .prepare(
              "INSERT OR REPLACE INTO hidden_references(id,hidden_at,reason) VALUES(?,?,?)",
            )
            .run(report.offer_id, now, note);
        const row =
          this.store.db
            .prepare("SELECT payload FROM offers WHERE id=?")
            .get(report.offer_id) ||
          this.store.db
            .prepare(
              "SELECT payload FROM offers WHERE canonical_url=? AND moderation!='rejected'",
            )
            .get(canonicalUrl(JSON.parse(report.offer_snapshot).sourceUrl));
        if (row)
          this.store.writeOffer({
            ...JSON.parse(row.payload),
            moderationStatus: "withdrawn",
            status: "withdrawn",
          });
      }
      const status = body.action === "dismiss" ? "dismissed" : "resolved";
      this.store.db
        .prepare(
          "UPDATE offer_reports SET status=?,reviewed_at=?,review_note=?,last_action=? WHERE id=?",
        )
        .run(status, now, note, body.action, id);
      return { id, status };
    });
  }
}
