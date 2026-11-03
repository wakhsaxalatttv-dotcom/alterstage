// Narrow exception explicitly requested by the owner for these nine uploaded cards.
// Confirmation is not a publication date and cannot be renewed at startup.
export const TOYOTA_OWNER_CONFIRMATION = Object.freeze({
  "confirmedAt": "2026-11-03T11:02:16Z",
  "sourceSha256": "29cab6ef54d7cf77bde4580047f4329f36f72edf9f08d03adae39cb26293c916",
  "records": {
    "8639004": "https://nousrecrutons.toyotafr.com/jobs/8639004-stage-ingenieur-excellence-operationnelle-maintenance-f-h",
    "8636230": "https://nousrecrutons.toyotafr.com/jobs/8636230-stage-ingenieur-digitalisation-des-processus-industriels-f-h",
    "8632799": "https://nousrecrutons.toyotafr.com/jobs/8632799-stage-ingenieur-digitalisation-outils-informatiques-f-h",
    "8626893": "https://nousrecrutons.toyotafr.com/jobs/8626893-stage-ingenieur-projet-industriel-atelier-plastique-f-h",
    "8625120": "https://nousrecrutons.toyotafr.com/jobs/8625120-stage-ingenieur-amelioration-continue-atelier-plastique-f-h",
    "8580379": "https://nousrecrutons.toyotafr.com/jobs/8580379-stage-ingenieur-methodes-et-industrialisation-f-h",
    "8580375": "https://nousrecrutons.toyotafr.com/jobs/8580375-stage-ingenieur-excellence-operationnelle-tps-f-h",
    "8580367": "https://nousrecrutons.toyotafr.com/jobs/8580367-stage-ingenieur-automatisme-et-supervision-des-equipements-f-h",
    "8580365": "https://nousrecrutons.toyotafr.com/jobs/8580365-stage-ingenieur-projet-metrologie-et-qualite-industrielle-f-h"
  }
});
export function hasOwnerConfirmedToyotaListing(offer, now = Date.now()) {
  const batch = TOYOTA_OWNER_CONFIRMATION;
  if (offer?.sourceId !== 'toyota-upload' || offer.publishedAt || offer.sourcePublishedAt || offer.publicationEvidence) return false;
  const id = String(offer.externalId || '');
  const url = batch.records[id];
  if (!url || offer.id !== `toyota-${id}` || offer.sourceDocument?.recordId !== id || offer.sourceDocument?.sha256 !== batch.sourceSha256) return false;
  if (offer.sourceUrl !== url || offer.applicationUrl !== url) return false;
  if (offer.editorialConfirmation?.kind !== 'owner-confirmation' || offer.editorialConfirmation.confirmedAt !== batch.confirmedAt) return false;
  const checked = Date.parse(batch.confirmedAt);
  return checked <= now && now - checked < 30 * 86400000;
}
