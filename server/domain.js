export const CONTRACTS = { E1: 'Stage', E2: 'Apprentissage', FS: 'Contrat de professionnalisation' };
export function safeUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; } catch { return null; }
}
export function deduplicate(offers) {
  const ids = new Set(), signatures = new Set(), urls = new Set();
  return offers.filter(o => {
    const signature = [o.title, o.company.name, o.location.label].map(s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()).join('|');
    if (ids.has(o.id) || signatures.has(signature) || urls.has(o.sourceUrl)) return false;
    ids.add(o.id); signatures.add(signature); urls.add(o.sourceUrl); return true;
  });
}
// Retrieval proves that the API returned an offer; it does not verify that recruitment is still open.
export function normalizeOffer(raw, retrievedAt) {
  // Conservatively exclude identifiable education/training advertisers. Ambiguous records stay unverified.
  const advertiser = raw.entreprise?.nom || '';
  if (String(raw.secteurActivite || '').startsWith('85') || /\b(école|ecole|campus|cfa|centre de formation|organisme de formation)\b/i.test(advertiser)) return null;
  const sourceUrl = safeUrl(raw.origineOffre?.urlOrigine) || safeUrl(raw.contact?.urlPostulation);
  if (!raw.id || !raw.intitule || !raw.entreprise?.nom || !CONTRACTS[raw.typeContrat] || !sourceUrl) return null;
  return {
    id: `france-travail:${raw.id}`, title: raw.intitule,
    company: { id: raw.entreprise.siret || raw.entreprise.nom.toLowerCase(), name: raw.entreprise.nom, sector: raw.secteurActiviteLibelle || null, website: safeUrl(raw.entreprise.url), location: raw.lieuTravail?.libelle || null },
    contract: CONTRACTS[raw.typeContrat], location: {label: raw.lieuTravail?.libelle || null, commune: raw.lieuTravail?.commune || null, region: null},
    domain: raw.romeLibelle || null, education: raw.formations?.map(f => f.niveauLibelle).filter(Boolean) || [],
    sourceUrl, applicationUrl: safeUrl(raw.contact?.urlPostulation) || sourceUrl, source: 'France Travail',
    publishedAt: raw.dateCreation || null, firstRetrievedAt: retrievedAt, lastVerifiedAt: null, status: 'to_verify',
    description: raw.description || null, skills: raw.competences?.map(c => c.libelle).filter(Boolean) || [], missions: [],
    duration: raw.dureeTravailLibelle || null, startsAt: null, publicContacts: [], sponsored: false,
  };
}
