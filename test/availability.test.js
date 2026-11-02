import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { closureEvidence, auditAvailability } from "../server/ingestion/availability.js";
import { Reports } from "../server/reports.js";

test("only explicit page closure or gone/not-found withdraws a vacancy", () => {
  for (const text of ["Cette offre n’est plus disponible", "Cette annonce est clôturée", "This job has expired", "Cette offre a été pourvue"])
    assert.ok(closureEvidence(200, `<main>${text}</main>`));
  assert.ok(closureEvidence(404));
  assert.ok(closureEvidence(410));
  assert.equal(closureEvidence(403, "Cette offre est clôturée"), null);
  assert.equal(closureEvidence(200, '<script>"Cette offre est clôturée"</script><h1>Stage ouvert</h1>'), null);
  assert.equal(closureEvidence(200, "Nous analysons pourquoi une offre est clôturée."), null);
});

test("closed pages disappear from offers and repérées, survive reingestion; inconclusive checks keep the vacancy unverified", async () => {
  const folder = await mkdtemp('/tmp/availability-test-'), store = new OfferStore(folder);
  try {
    const snapshot = JSON.parse(await readFile(new URL('../config/market-offers.json', import.meta.url)));
    const [closed, unknown] = structuredClone(snapshot.offers.slice(0, 2));
    for (const [i, o] of [closed, unknown].entries()) {
      o.sourceUrl = o.applicationUrl = `https://example.org/availability-fixture-${i}`;
      await store.ingest(o);
    }
    const now = Date.now();
    const result = await auditAvailability(store, { now, check: async (url) => url === closed.applicationUrl ? { state: 'closed', evidence: 'HTTP 410' } : { state: 'unknown' } });
    assert.equal(result.closed, 1);
    const stored = JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(closed.id).payload);
    assert.equal(stored.moderationStatus, 'withdrawn');
    assert.ok(stored.sourceClosedAt);
    assert.equal(new Reports(store).references().some((o) => o.id === closed.id), false);
    const retained = JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(unknown.id).payload);
    assert.equal(retained.moderationStatus, 'approved');
    assert.equal(retained.lastVerifiedAt, null);
    await store.ingest({ ...closed, contentHash: 'changed-after-closure', lastFetchedAt: new Date(now + 1000).toISOString() });
    assert.equal(JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(closed.id).payload).moderationStatus, 'withdrawn');
    assert.equal((await auditAvailability(store, { now: now + 1000, check: async () => { throw Error('must respect cooldown'); } })).checked, 0);
  } finally { store.close(); await rm(folder, { recursive: true, force: true }); }
});

import { openApplicationEvidence } from '../server/ingestion/availability.js';
import { hasRecentOpenEvidence, OPEN_PROOF_MAX_AGE_MS } from '../shared/availability.js';
import { normalizeSubmission, publicOffer } from '../server/domain.js';
import { selectOffers, defaultFilters } from '../src/domain.js';
const applicationFixture = () => normalizeSubmission({
  title: 'Stage comptabilité — exemple fictif', companyName: 'PME fictive',
  companyWebsite: 'https://example.org', sourceUrl: 'https://example.org/jobs/proof-fixture',
  city: 'Nantes', region: 'Pays de la Loire', contract: 'Stage', domain: 'Comptabilité, finance & audit',
  description: 'Exemple réservé aux tests, jamais publié.',
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10), consent: true,
});
function jobHtml(offer, changes = {}, action = '<a href="/apply">Postuler</a>') {
  return '<main><h1>' + offer.title + '</h1>' + action + '</main><script type="application/ld+json">' + JSON.stringify({
    '@type': 'JobPosting', title: offer.title, hiringOrganization: { name: offer.company.name },
    validThrough: new Date(Date.now() + 7 * 86400000).toISOString(), ...changes,
  }) + '</script>';
}
test('positive proof requires the exact employer and role, a future deadline and an enabled application action', () => {
  const offer = applicationFixture();
  assert.ok(openApplicationEvidence(jobHtml(offer), offer));
  for (const html of [
    '<h1>Careers</h1><a href="/apply">Apply</a>',
    jobHtml(offer, { title: 'Autre poste' }),
    jobHtml(offer, { hiringOrganization: { name: 'Autre entreprise' } }),
    jobHtml(offer, { validThrough: '2020-01-01' }),
    jobHtml(offer, { validThrough: undefined }),
    jobHtml(offer, {}, '<button disabled>Postuler</button>'),
    jobHtml(offer, {}, '<button aria-disabled="true">Postuler</button>'),
    jobHtml(offer, {}, '<a href="/home">Accueil</a>'),
    jobHtml(offer) + '<p>Ce poste est déjà pourvu.</p>',
    jobHtml(offer) + '<p>Cette offre n’est plus disponible.</p>',
  ]) assert.equal(openApplicationEvidence(html, offer), null, html);
});
test('availability evidence expires at 24 hours and cannot be reused for a different application URL', () => {
  const offer = applicationFixture(), now = Date.now();
  offer.availabilityEvidence = openApplicationEvidence(jobHtml(offer), offer, now);
  assert.equal(hasRecentOpenEvidence(offer, now), true);
  assert.equal(hasRecentOpenEvidence(offer, now - 1), false);
  assert.equal(hasRecentOpenEvidence(offer, now + OPEN_PROOF_MAX_AGE_MS - 1), true);
  assert.equal(hasRecentOpenEvidence(offer, now + OPEN_PROOF_MAX_AGE_MS), false);
  assert.equal(hasRecentOpenEvidence({ ...offer, applicationUrl: 'https://example.org/different' }, now), false);
  assert.equal(hasRecentOpenEvidence({ ...offer, availabilityEvidence: { kind: 'provider-active', checkedAt: new Date(now).toISOString() } }, now), false);
});
test('all public views and SQL counters require positive evidence; an inconclusive recheck hides the offer without declaring it closed', async () => {
  const folder = await mkdtemp('/tmp/open-proof-test-'), store = new OfferStore(folder);
  try {
    const offer = { ...applicationFixture(), moderationStatus: 'approved', sourcePolicyApproved: true, sourceId: 'fixture-only', externalId: 'proof', contentHash: 'fixture-v1', lastFetchedAt: new Date().toISOString() };
    await store.ingest(offer);
    assert.equal((await store.query()).total, 0);
    assert.equal(await store.getPublic(offer.id), null);
    assert.equal(selectOffers([offer], defaultFilters).length, 0);
    assert.equal(new Reports(store).references().some((o) => o.id === offer.id), false);
    const now = Date.now();
    const checked = await auditAvailability(store, { now, check: async (_url, candidate) => ({ state: 'open', evidence: openApplicationEvidence(jobHtml(candidate), candidate, now) }) });
    assert.equal(checked.opened, 1);
    assert.equal((await store.query()).total, 1);
    const visible = await store.getPublic(offer.id);
    assert.equal(visible.lastVerifiedAt, null);
    assert.equal(visible.status, 'to_verify');
    assert.equal(new Reports(store).references().some((o) => o.id === offer.id), true);
    assert.equal(selectOffers([visible], defaultFilters, now + OPEN_PROOF_MAX_AGE_MS).length, 0);
    assert.equal(publicOffer({ ...visible, moderationStatus: 'approved' }, now + OPEN_PROOF_MAX_AGE_MS), null);
    await auditAvailability(store, { now: now + 6 * 3600000, check: async () => ({ state: 'unknown' }) });
    assert.equal((await store.query()).total, 0);
    const preserved = (await store.read())[0];
    assert.equal(preserved.moderationStatus, 'approved');
    assert.equal(preserved.sourceClosedAt, undefined);
  } finally { store.close(); await rm(folder, { recursive: true, force: true }); }
});
test('public submissions cannot forge availability evidence or manual verification', () => {
  const offer = applicationFixture();
  const injected = normalizeSubmission({
    title: offer.title, companyName: offer.company.name, companyWebsite: offer.company.website,
    sourceUrl: offer.sourceUrl, city: 'Nantes', region: offer.location.region, domain: offer.domain,
    contract: offer.contract, description: offer.description, publishedAt: offer.publishedAt,
    expiresAt: offer.expiresAt, consent: true,
    availabilityEvidence: { kind: 'manual-review', openConfirmed: true, checkedAt: new Date().toISOString(), url: offer.sourceUrl },
    lastVerifiedAt: new Date().toISOString(), moderationStatus: 'approved',
  });
  assert.equal(injected.availabilityEvidence, undefined);
  assert.equal(injected.lastVerifiedAt, null);
  assert.equal(injected.moderationStatus, 'pending');
});
