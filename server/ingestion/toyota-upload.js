import {createHash} from 'node:crypto';
import uploaded from '../../config/toyota-pending.json' with {type: 'json'};
import {TOYOTA_OWNER_CONFIRMATION as confirmation} from '../../shared/toyota-owner-confirmation.js';
import {normalizeSubmission} from '../domain.js';

// Only the owner's fixed, explicitly checked Toyota upload is eligible here.
export async function seedToyotaUpload(store) {
  const report = {created: 0, updated: 0, existing: 0, invalid: 0};
  for (const record of uploaded.offers) {
    if (uploaded.sourceDocument.sha256 !== confirmation.sourceSha256 || confirmation.records[record.externalId] !== record.sourceUrl) {
      report.invalid++;
      continue;
    }
    const id = `toyota-${record.externalId}`;
    const row = store.db.prepare('SELECT payload FROM offers WHERE id=? OR canonical_url=?').get(id, record.sourceUrl);
    const previous = row ? JSON.parse(row.payload) : null;
    if (previous && (['withdrawn', 'rejected'].includes(previous.moderationStatus) || previous.sourceClosedAt || previous.publishedAt || previous.sourcePublishedAt)) {
      report.existing++;
      continue;
    }
    const domain = /Automatisme/.test(record.title) ? 'Automatismes & robotique'
      : /métrologie/.test(record.title) ? 'Qualité, sécurité & métrologie'
      : /Outils Informatiques/.test(record.title) ? 'Développement logiciel & web'
      : /Maintenance/.test(record.title) ? 'Maintenance industrielle'
      : 'Conception, méthodes & bureau d’études';
    const offer = normalizeSubmission({
      ...record,
      companyWebsite: 'https://nousrecrutons.toyotafr.com',
      domain,
      description: `Toyota Motor Manufacturing France propose le stage « ${record.title} » à Onnaing. Consultez la fiche employeur pour les missions détaillées, les conditions et la candidature.`,
      publishedAt: '', consent: true, origin: 'editorial',
      // Retention deadline for this exception; never an employer closing date.
      expiresAt: new Date(Date.parse(confirmation.confirmedAt) + 30 * 86400000).toISOString().slice(0, 10),
    });
    offer.company.id = 'employer-company:toyota-motor-manufacturing-france';
    Object.assign(offer, {
      id, sourceId: 'toyota-upload', sourceName: 'Toyota — portail employeur',
      externalId: record.externalId, sourcePolicyApproved: true,
      editorialConfirmation: {kind: 'owner-confirmation', confirmedAt: confirmation.confirmedAt},
      firstRetrievedAt: previous?.firstRetrievedAt || confirmation.confirmedAt,
      lastFetchedAt: confirmation.confirmedAt,
      sourcePublishedAt: null, sourceDateMissing: true, lastVerifiedAt: null,
      sourceDocument: {...uploaded.sourceDocument, recordId: record.externalId, descriptionAvailable: false, onlineAvailabilityChecked: false},
      reviewNote: 'Publication demandée après vérification du responsable ; date de publication non fournie.',
    });
    offer.contentHash = createHash('sha256').update(JSON.stringify({record, confirmation})).digest('hex');
    const result = await store.ingest(offer);
    if (result === 'created') report.created++;
    else if (result === 'updated') report.updated++;
    else if (result === 'unchanged') report.existing++;
    else report.invalid++;
  }
  return report;
}
