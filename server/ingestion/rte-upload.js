import {createHash} from 'node:crypto';
import uploaded from '../../config/rte-pending.json' with {type: 'json'};
import {RTE_OWNER_CONFIRMATION as confirmation} from '../../shared/rte-owner-confirmation.js';
import {normalizeSubmission} from '../domain.js';

// Only the owner's fixed, explicitly checked Rte upload is eligible here.
export async function seedRteUpload(store) {
  const report = {created: 0, updated: 0, existing: 0, invalid: 0};
  for (const record of uploaded.offers) {
    if (uploaded.sourceDocument.sha256 !== confirmation.sourceSha256 || confirmation.records[record.externalId] !== record.sourceUrl) {
      report.invalid++;
      continue;
    }
    const id = `rte-${record.externalId}`;
    const row = store.db.prepare('SELECT payload FROM offers WHERE id=? OR canonical_url=?').get(id, record.sourceUrl);
    const previous = row ? JSON.parse(row.payload) : null;
    if (previous && (['withdrawn', 'rejected'].includes(previous.moderationStatus) || previous.sourceClosedAt || previous.publishedAt || previous.sourcePublishedAt)) {
      report.existing++;
      continue;
    }
    const regionByDepartment = {
      'Hauts-de-Seine (92)': 'Île-de-France', 'Rhône (69)': 'Auvergne-Rhône-Alpes',
      'Loiret (45)': 'Centre-Val de Loire', 'Vaucluse (84)': 'Provence-Alpes-Côte d’Azur',
      'Nord (59)': 'Hauts-de-France', 'Meurthe-et-Moselle (54)': 'Grand Est',
      'Maine-et-Loire (49)': 'Pays de la Loire', 'Loire-Atlantique (44)': 'Pays de la Loire',
      'Haute-Garonne (31)': 'Occitanie', 'Saône-et-Loire (71)': 'Bourgogne-Franche-Comté',
    };
    const domain = /Juriste/.test(record.title) ? 'Droit & administration'
      : /Communication/.test(record.title) ? 'Marketing & communication'
      : /Intelligence Artificielle|données patrimoniales/.test(record.title) ? 'Data, IA & machine learning'
      : /Développeur|SharePoint|Interfaces/.test(record.title) ? 'Développement logiciel & web'
      : /captation/.test(record.title) ? 'Télécommunications'
      : /Automatismes/.test(record.title) ? 'Automatismes & robotique'
      : /maintenance en postes/.test(record.title) ? 'Électricité & électrotechnique'
      : /carbone|électrique|énergétique/.test(record.title) ? 'Énergie & environnement'
      : /sécurité/.test(record.title) ? 'Qualité, sécurité & métrologie'
      : /Pédagogique/.test(record.title) ? 'Social, éducation & animation'
      : 'Assistanat & gestion';
    const offer = normalizeSubmission({
      ...record, city: record.listingLocation, region: regionByDepartment[record.listingLocation],
      companyWebsite: 'https://www.rte-france.com',
      domain,
      description: `RTE propose le stage « ${record.title} » dans le département ${record.listingLocation}. Consultez la fiche employeur pour les missions détaillées, les conditions et la candidature.`,
      publishedAt: '', consent: true, origin: 'editorial',
      // Retention deadline for this exception; never an employer closing date.
      expiresAt: new Date(Date.parse(confirmation.confirmedAt) + 30 * 86400000).toISOString().slice(0, 10),
    });
    offer.company.id = 'employer-company:rte-france';
    Object.assign(offer, {
      id, sourceId: 'rte-upload', sourceName: 'RTE — portail employeur',
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
