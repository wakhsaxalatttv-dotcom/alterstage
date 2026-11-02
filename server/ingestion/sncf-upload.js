import uploaded from "../../config/sncf-pending.json" with { type: "json" };
import { normalizeSubmission } from "../domain.js";
// Missing source dates remain missing. These saved cards never auto-publish.
// No HTML/script from an upload is executed, and existing decisions are preserved.
export async function seedSncfPending(store) {
  const report = { created: 0, existing: 0, invalid: 0 };
  for (const record of uploaded.offers) {
    const id = `sncf-${record.externalId}`;
    if (store.db.prepare("SELECT id FROM offers WHERE id=? OR canonical_url=?").get(id, record.sourceUrl)) {
      report.existing++;
      continue;
    }
    try {
      const offer = normalizeSubmission({
        ...record, education: "", publishedAt: "", consent: true, origin: "editorial",
        // Internal queue retention only, never an employer closing date.
        expiresAt: new Date(Date.parse(uploaded.savedAt) + 30 * 86400000).toISOString().slice(0, 10),
      });
      Object.assign(offer, {
        id, sourceId: "sncf-upload", sourceName: "SNCF — fichier employeur",
        source: "Annonce SNCF — date à établir", externalId: record.externalId,
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
        reviewNote: "Date de publication et description détaillée absentes du fichier MHTML. Ne pas utiliser la date d’enregistrement comme publication.",
      });
      await store.submit(offer);
      report.created++;
    } catch { report.invalid++; }
  }
  return report;
}
