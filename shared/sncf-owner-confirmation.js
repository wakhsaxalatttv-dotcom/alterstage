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
export const SNCF_STAGE_CONFIRMATION = Object.freeze({
  "confirmedAt": "2026-11-02T14:08:59Z",
  "sourceSha256": "e7720b3706c1c0fadeab412f2d0118f57278a01b36a2c9d4a3ce8599200f3209",
  "recordIds": [
    "886156",
    "885307",
    "884087",
    "882560",
    "880389",
    "819502",
    "877333",
    "873647",
    "871175",
    "798355",
    "875849",
    "874703",
    "850735",
    "788699",
    "829699",
    "658172",
    "829700",
    "832320",
    "687444",
    "647391"
  ]
});
export const SNCF_OWNER_CONFIRMATIONS = [SNCF_OWNER_CONFIRMATION, SNCF_STAGE_CONFIRMATION];
export function hasOwnerConfirmedSncfListing(offer, now = Date.now()) {
  if (offer?.sourceId !== "sncf-upload" || offer.publishedAt || offer.sourcePublishedAt || offer.publicationEvidence) return false;
  const confirmation = offer.editorialConfirmation;
  if (!confirmation || confirmation.kind !== "owner-confirmation") return false;
  const id = String(offer.externalId || "");
  const batch = SNCF_OWNER_CONFIRMATIONS.find((b) => b.confirmedAt === confirmation.confirmedAt && b.sourceSha256 === offer.sourceDocument?.sha256 && b.recordIds.includes(id));
  if (!batch || offer.id !== `sncf-${id}` || offer.sourceDocument?.recordId !== id) return false;
  if (offer.sourceUrl !== `https://emploi.sncf.com/nos-offres/${id}` || offer.applicationUrl !== offer.sourceUrl) return false;
  const checked = Date.parse(confirmation.confirmedAt);
  return Number.isFinite(checked) && checked <= now && now - checked < 30 * 86400000;
}
