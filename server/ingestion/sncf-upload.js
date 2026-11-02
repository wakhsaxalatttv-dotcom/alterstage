import { searchText } from "../enrichment.js";
import { createHash } from "node:crypto";
import { SNCF_OWNER_CONFIRMATION } from "../../shared/sncf-owner-confirmation.js";
import uploaded from "../../config/sncf-pending.json" with { type: "json" };
import { normalizeSubmission } from "../domain.js";
// Explicit owner confirmation authorizes these cards; missing publication dates stay missing.
// No HTML/script from an upload is executed, and existing decisions are preserved.
export async function seedSncfPending(store) {
  const report = { created: 0, updated: 0, existing: 0, invalid: 0 };
  for (const record of uploaded.offers) {
    const id = `sncf-${record.externalId}`;
    const previous = store.db.prepare("SELECT payload FROM offers WHERE id=? OR canonical_url=?").get(id, record.sourceUrl);
    const previousOffer = previous ? JSON.parse(previous.payload) : null;
    if (previousOffer && (["withdrawn", "rejected"].includes(previousOffer.moderationStatus) || previousOffer.sourceClosedAt)) {
      report.existing++;
      continue;
    }
    try {
      const offer = normalizeSubmission({
        ...record, education: "", publishedAt: "", consent: true, origin: "editorial",
        // Internal queue retention only, never an employer closing date.
        expiresAt: new Date(Date.parse(SNCF_OWNER_CONFIRMATION.confirmedAt) + 30 * 86400000).toISOString().slice(0, 10),
      });
      const knownCompany = store.db.prepare("SELECT id,payload FROM companies WHERE name_key=?").all(searchText(record.companyName))
        .find((row) => JSON.parse(row.payload).website === record.companyWebsite);
      offer.company.id = knownCompany?.id || "employer-company:" + createHash("sha256").update(record.companyName + "|" + record.companyWebsite).digest("hex").slice(0, 20);
      Object.assign(offer, {
        id, sourceId: "sncf-upload", sourceName: "SNCF — fichier employeur",
        source: "Annonce SNCF", externalId: record.externalId,
        sourcePolicyApproved: true,
        editorialConfirmation: { kind: "owner-confirmation", confirmedAt: SNCF_OWNER_CONFIRMATION.confirmedAt },
        firstRetrievedAt: previousOffer?.firstRetrievedAt || uploaded.savedAt,
        lastFetchedAt: uploaded.savedAt,
        sourcePublishedAt: null, sourceDocument: record.sourceDocument,
        sourceDateMissing: true, lastVerifiedAt: null,
        sourceEducationLabel: record.education,
        education: [
          ...(record.education.includes("Niveau 3") ? ["CAP / BEP"] : []),
          ...(record.education.includes("Niveau 4") ? ["Bac"] : []),
          ...(record.education.includes("Niveau 5") ? ["Bac + 2"] : []),
          ...(record.education.includes("Niveau 6") ? ["Bac + 3"] : []),
          ...(record.education.includes("Niveau 7") ? ["Bac + 5 et plus"] : []),
        ],
        reviewNote: "Publication expressément autorisée par le responsable après sa vérification des offres SNCF fournies. Date source non fournie ; ne pas dater l’annonce à la date de confirmation.",
      });
      offer.contentHash = createHash("sha256").update(JSON.stringify({ record, companyId: offer.company.id, confirmation: offer.editorialConfirmation })).digest("hex");
      const result = await store.ingest(offer);
      if (result === "created") report.created++;
      else if (result === "updated") report.updated++;
      else if (result === "unchanged") report.existing++;
      else report.invalid++;
    } catch { report.invalid++; }
  }
  return report;
}
