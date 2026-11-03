// Narrow exception explicitly requested by the owner for these 21 uploaded cards.
// Confirmation is not a publication date and cannot be renewed at startup.
export const RTE_OWNER_CONFIRMATION = Object.freeze({
  "confirmedAt": "2026-11-03T14:46:33Z",
  "sourceSha256": "7096fcf22b48a8882e4f6a2ffdaab5a43ab8dc85ef6f91144dbb19cf67a1efb7",
  "records": {
    "ref4477s": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-appui-mise-place-budget-carbone-f-h",
    "ref4631b": "https://www.rte-france.com/carrieres/recrutement/stage-charge-modernisation-documentaire-sharepoint-f-h",
    "ref4668n": "https://www.rte-france.com/carrieres/recrutement/stage-ingenieur-pedagogique-vr-ar-3d-f-h",
    "ref4689q": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-charge-demantelement-it-f-h",
    "ref4249w": "https://www.rte-france.com/carrieres/recrutement/stage-assistant-appui-management-f-h",
    "ref4541y": "https://www.rte-france.com/carrieres/recrutement/stage-charge-projets-intelligence-artificielle-data-f-h",
    "ref4540t": "https://www.rte-france.com/carrieres/recrutement/stage-assistant-support-management-f-h",
    "ref4661o": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-juriste-f-h",
    "ref4639x": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-etudes-echanges-electriques-transfrontaliers-f-h",
    "ref4527m": "https://www.rte-france.com/carrieres/recrutement/stage-charge-pilotage-energetique-technique-batiments-f-h",
    "ref4627k": "https://www.rte-france.com/carrieres/recrutement/stage-concepteur-solution-mobile-captation-4-5g-f-h",
    "ref4630b": "https://www.rte-france.com/carrieres/recrutement/stage-analyse-mise-jour-donnees-patrimoniales-h-f",
    "ref4479e": "https://www.rte-france.com/carrieres/recrutement/stage-appui-classement-archivage-etudes-sol-f-h",
    "ref4579h": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-charge-etude-sur-modelisation-incertitudes-systeme-electrique-f-h",
    "ref4616h": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-ingenieur-interfaces-f-h",
    "ref4506i": "https://www.rte-france.com/carrieres/recrutement/stage-assistant-communication-fablab-rte-f-h",
    "ref4640k": "https://www.rte-france.com/carrieres/recrutement/stage-technicien-maintenance-automatismes-systemes-industriels-f-h-0",
    "ref4499g": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-charge-modelisation-process-metiers-f-h",
    "ref4605r": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-charge-pilotage-securite-processus-direction-f-h",
    "ref4622c": "https://www.rte-france.com/carrieres/recrutement/stage-technicien-maintenance-postes-electriques-f-h",
    "ref4584y": "https://www.rte-france.com/carrieres/recrutement/stage-pfe-concepteur-developpeur-applications-f-h"
  }
});
export function hasOwnerConfirmedRteListing(offer, now = Date.now()) {
  const batch = RTE_OWNER_CONFIRMATION;
  if (offer?.sourceId !== 'rte-upload' || offer.publishedAt || offer.sourcePublishedAt || offer.publicationEvidence) return false;
  const id = String(offer.externalId || '');
  const url = batch.records[id];
  if (!url || offer.id !== `rte-${id}` || offer.sourceDocument?.recordId !== id || offer.sourceDocument?.sha256 !== batch.sourceSha256) return false;
  if (offer.sourceUrl !== url || offer.applicationUrl !== url) return false;
  if (offer.editorialConfirmation?.kind !== 'owner-confirmation' || offer.editorialConfirmation.confirmedAt !== batch.confirmedAt) return false;
  const checked = Date.parse(batch.confirmedAt);
  return checked <= now && now - checked < 30 * 86400000;
}
