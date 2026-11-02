// Explicit owner confirmation applies only to these 20 SNCF cards supplied in the MHTML.
// This is an editorial exception for undated listings, never a publication date.
export const SNCF_OWNER_CONFIRMATION = Object.freeze({
  "confirmedAt": "2026-11-02T13:54:36Z",
  "sourceSha256": "af448f3f7a75e3fe26d2629f174b723ec18088ac7bf58021bade27ff54377206",
  "recordIds": [
    "885141",
    "884146",
    "884088",
    "883606",
    "883429",
    "780164",
    "881992",
    "799416",
    "880390",
    "816292",
    "878016",
    "818586",
    "816326",
    "869867",
    "834997",
    "835404",
    "834300",
    "819940",
    "662704",
    "817604"
  ]
});
export function hasOwnerConfirmedSncfListing(offer, now = Date.now()) {
  if (offer?.sourceId !== "sncf-upload" || offer.publishedAt || offer.sourcePublishedAt || offer.publicationEvidence) return false;
  const confirmation = offer.editorialConfirmation;
  if (!confirmation || confirmation.kind !== "owner-confirmation" || confirmation.confirmedAt !== SNCF_OWNER_CONFIRMATION.confirmedAt) return false;
  const id = String(offer.externalId || "");
  if (!SNCF_OWNER_CONFIRMATION.recordIds.includes(id) || offer.id !== `sncf-${id}`) return false;
  if (offer.sourceDocument?.sha256 !== SNCF_OWNER_CONFIRMATION.sourceSha256 || offer.sourceDocument?.recordId !== id) return false;
  if (offer.sourceUrl !== `https://emploi.sncf.com/nos-offres/${id}` || offer.applicationUrl !== offer.sourceUrl) return false;
  const checked = Date.parse(confirmation.confirmedAt);
  return Number.isFinite(checked) && checked <= now && now - checked < 30 * 86400000;
}
