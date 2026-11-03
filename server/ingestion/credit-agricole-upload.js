import {createHash} from 'node:crypto';
import uploaded from '../../config/credit-agricole-pending.json' with {type: 'json'};
import {CREDIT_AGRICOLE_OWNER_CONFIRMATION as confirmation} from '../../shared/credit-agricole-owner-confirmation.js';
import {normalizeSubmission} from '../domain.js';
import {searchText} from '../enrichment.js';

function domainOf(record) {
  const title = searchText(record.title), category = searchText(record.sourceJobCategory);
  if (/cybersecurite|risques it/.test(title)) return 'Cybersécurité';
  if (/data scientist|statistiques|data analyst/.test(title)) return 'Data, IA & machine learning';
  if (/developpeur/.test(title)) return 'Développement logiciel & web';
  if (/support it/.test(title)) return 'Support & maintenance informatique';
  if (/it, digital/.test(category)) return 'Autres métiers informatiques';
  if (/juridique|juriste/.test(category + ' ' + title)) return 'Droit & administration';
  if (/marketing|communication|graphiste/.test(category + ' ' + title)) return 'Marketing & communication';
  if (/ressources humaines/.test(category)) return 'Ressources humaines';
  if (/finances|comptabilite|audit|analyse financiere/.test(category)) return 'Comptabilité, finance & audit';
  if (/assurances|financement|risques|conformite|securite financiere/.test(category)) return 'Banque, assurance & immobilier';
  if (/commercial/.test(category)) return 'Commerce & vente';
  return 'Conseil & gestion de projet';
}

// The fixed owner confirmation never expands to other offers or refreshes at startup.
export async function seedCreditAgricoleUpload(store) {
  const report = {created: 0, updated: 0, existing: 0, invalid: 0};
  const titleKey = r => [r.title, r.companyName, r.city].map(searchText).join('|');
  const counts = new Map();
  for (const r of uploaded.offers) counts.set(titleKey(r), (counts.get(titleKey(r)) || 0) + 1);
  for (const record of uploaded.offers) {
    const approved = confirmation.records[record.externalId];
    if (!approved || approved.url !== record.sourceUrl || approved.sha256 !== record.sourceDocument.sha256 || record.countryCode !== 'FR') {
      report.invalid++;
      continue;
    }
    const id = `credit-agricole-${record.externalId}`;
    const row = store.db.prepare('SELECT payload FROM offers WHERE id=? OR canonical_url=?').get(id, record.sourceUrl);
    const previous = row ? JSON.parse(row.payload) : null;
    if (previous && (['withdrawn', 'rejected'].includes(previous.moderationStatus) || previous.sourceClosedAt || previous.publishedAt || previous.sourcePublishedAt)) {
      report.existing++;
      continue;
    }
    const offer = normalizeSubmission({
      ...record, domain: domainOf(record), logoConsent: Boolean(record.companyLogoUrl),
      // Different employer references may share a title and city. Retain each
      // supplied reference without inventing differences in its missions.
      title: counts.get(titleKey(record)) > 1 ? `${record.title} (réf. ${record.externalId})` : record.title,
      description: `${record.companyName} propose ${record.contract === 'Stage' ? 'le stage' : 'une alternance'} « ${record.title} » à ${record.city}, dans la catégorie ${record.sourceJobCategory}. Consultez la fiche employeur pour les missions détaillées, les conditions et la candidature.`,
      publishedAt: '', consent: true, origin: 'editorial',
      // Internal retention deadline, never an employer closing date.
      expiresAt: new Date(Date.parse(confirmation.confirmedAt) + 30 * 86400000).toISOString().slice(0, 10),
    });
    offer.company.id = 'employer-company:' + createHash('sha256').update(record.companyName + '|' + record.companyWebsite).digest('hex').slice(0, 20);
    Object.assign(offer, {
      id, sourceId: 'credit-agricole-upload', sourceName: 'Crédit Agricole — portail employeur',
      externalId: record.externalId, sourcePolicyApproved: true,
      editorialConfirmation: {kind: 'owner-confirmation', confirmedAt: confirmation.confirmedAt},
      firstRetrievedAt: previous?.firstRetrievedAt || confirmation.confirmedAt,
      lastFetchedAt: confirmation.confirmedAt,
      sourcePublishedAt: null, sourceDateMissing: true, lastVerifiedAt: null,
      sourceUpdatedAt: record.sourceUpdatedAt, sourceDateLabel: record.sourceDateLabel,
      sourceDocument: {...record.sourceDocument, sourceTitle: record.title},
      reviewNote: 'Publication demandée après vérification du responsable ; la date de mise à jour n’est pas une date de publication.',
    });
    offer.contentHash = createHash('sha256').update(JSON.stringify({record, confirmation: offer.editorialConfirmation})).digest('hex');
    const result = await store.ingest(offer);
    if (result === 'created') report.created++;
    else if (result === 'updated') report.updated++;
    else if (result === 'unchanged') report.existing++;
    else report.invalid++;
  }
  return report;
}
