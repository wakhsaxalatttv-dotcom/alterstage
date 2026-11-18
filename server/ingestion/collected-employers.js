import {readFile} from 'node:fs/promises';
import {seedEditorialCatalogue} from './editorial-catalogue.js';
import {canonicalUrl} from '../store.js';
import {safeUrl} from '../domain.js';
import {isBlockedSource} from '../../shared/source-policy.js';

// Employer observations are server-only: importing hundreds of references must
// not put their contents in the public JavaScript bundle or fake a human badge.
export function hasEmployerApplicationObservation(ref, now = Date.now()) {
  const doc = ref?.sourceDocument, proof = doc?.applicationEntry;
  if (doc?.kind !== 'employer-page' || doc.recordId !== ref.id || !/^[a-f0-9]{64}$/.test(doc.sha256 || '')) return false;
  if (!['France', 'French Guiana', 'Guadeloupe', 'Martinique', 'La Réunion', 'Mayotte'].includes(doc.sourceCountry)) return false;
  if (proof?.httpStatus !== 200 || proof.jobIdentityMatched !== true || proof.applicationActionFound !== true) return false;
  const checked = Date.parse(proof.checkedAt);
  if (!Number.isFinite(checked) || checked > now || now - checked > 30 * 86400000 || ref.sourceConsultedAt !== proof.checkedAt) return false;
  if (!safeUrl(ref.sourceUrl) || ref.applicationUrl !== ref.sourceUrl || !safeUrl(doc.pageUrl) || !safeUrl(proof.href)) return false;
  if (isBlockedSource({...ref, applicationUrl: proof.href})) return false;
  const page = new URL(doc.pageUrl), source = new URL(ref.sourceUrl);
  if (page.hostname !== source.hostname) return false;
  if (source.hostname === 'jobs.vinci.com') {
    return /^\d+$/.test(proof.jobPageId) && page.pathname.split('/').at(-1) === proof.jobPageId && source.pathname.split('/').at(-1) === proof.jobPageId;
  }
  return source.hostname === 'www.edf.fr' && source.pathname.startsWith('/edf-recrute/offre/detail/') && page.href === source.href;
}

export async function seedCollectedEmployers(store, file = new URL('../../config/collected-employers.json', import.meta.url)) {
  const snapshot = JSON.parse(await readFile(file, 'utf8'));
  if (snapshot.version !== 1 || !Array.isArray(snapshot.references) || !Array.isArray(snapshot.closed)) throw new Error('Collecte employeurs invalide');
  let withdrawn = 0, invalidEvidence = 0;
  for (const closed of snapshot.closed) {
    const checked = Date.parse(closed.checkedAt);
    if (![404, 410].includes(closed.httpStatus) || !Number.isFinite(checked) || checked > Date.now() || !safeUrl(closed.sourceUrl)) continue;
    const host = new URL(closed.sourceUrl).hostname;
    if (!['www.edf.fr', 'jobs.vinci.com'].includes(host)) continue;
    const row = store.db.prepare('SELECT id,payload FROM offers WHERE canonical_url=?').get(canonicalUrl(closed.sourceUrl));
    if (!row) continue;
    const old = JSON.parse(row.payload);
    if (['withdrawn', 'rejected'].includes(old.moderationStatus)) continue;
    store.transaction(() => store.writeOffer({
      ...old, status: 'withdrawn', moderationStatus: 'withdrawn',
      sourceClosedAt: closed.checkedAt, availabilityCheckedAt: closed.checkedAt,
      reviewNote: `Fiche employeur indisponible : HTTP ${closed.httpStatus}, contrôle du ${closed.checkedAt}.`,
    }));
    withdrawn++;
  }
  const references = [];
  for (const ref of snapshot.references) {
    if (!hasEmployerApplicationObservation(ref)) { invalidEvidence++; continue; }
    const row = store.db.prepare('SELECT payload FROM offers WHERE id=? OR canonical_url=?').get(ref.id, canonicalUrl(ref.sourceUrl));
    const previous = row ? JSON.parse(row.payload) : null;
    // A refreshed employer page never rejuvenates an already known initial date.
    const oldDate = previous?.sourcePublishedAt || previous?.publishedAt;
    references.push(oldDate && oldDate < (ref.sourcePublishedAt || ref.publishedAt)
      ? {...ref, publishedAt: oldDate.slice(0, 10), sourcePublishedAt: oldDate} : ref);
  }
  return {...await seedEditorialCatalogue(store, references), withdrawn, invalidEvidence};
}
