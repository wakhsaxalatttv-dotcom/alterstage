import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createApp } from '../server/app.js';
import { normalizeSubmission } from '../server/domain.js';
import { publicationCutoff } from '../shared/freshness.js';
import { selectOffers, defaultFilters } from '../src/domain.js';
test('recent offers without availability proof return to all public views; old, closed and withdrawn offers stay hidden', async () => {
  const folder = await mkdtemp('/tmp/restored-thirty-days-');
  const app = createApp({ folder, pipelineOptions: { sources: async () => [] } });
  const store = app.locals.store;
  const input = {
    title: 'Stage fictif de restauration du catalogue', companyName: 'Entreprise fictive', companyWebsite: 'https://example.org',
    sourceUrl: 'https://example.org/recent-fixture', contract: 'Stage', city: 'Paris', region: 'Île-de-France', domain: 'Commerce & vente',
    publishedAt: new Date().toISOString().slice(0, 10), expiresAt: new Date(Date.now()+7*86400000).toISOString().slice(0,10),
    description: 'Fictif, uniquement en base isolée de test.', consent: true,
  };
  const recent = { ...normalizeSubmission(input), moderationStatus: 'approved' };
  const oldDate = new Date(Date.parse(publicationCutoff()) - 86400000).toISOString().slice(0,10);
  const variants = [recent,
    { ...recent, id: 'old-fixture', title: 'Ancien fictif', sourceUrl: 'https://example.org/old-fixture', publishedAt: oldDate },
    { ...recent, id: 'closed-fixture', title: 'Clôturé fictif', sourceUrl: 'https://example.org/closed-fixture', sourceClosedAt: new Date().toISOString() },
    { ...recent, id: 'withdrawn-fixture', title: 'Retiré fictif', sourceUrl: 'https://example.org/withdrawn-fixture', moderationStatus: 'withdrawn', status: 'withdrawn' },
  ];
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r=>server.once('listening',r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const o of variants) await store.submit(o);
    store.auditPublicOffers();
    const list = await (await fetch(base+'/api/offers')).json();
    assert.equal(list.total, 1);
    assert.equal(list.offers[0].id, recent.id);
    assert.equal(list.offers[0].lastVerifiedAt, null);
    assert.equal(list.offers[0].availabilityEvidence, undefined);
    assert.equal((await fetch(base+'/api/offers/'+recent.id)).status, 200);
    assert.equal((await fetch(base+'/api/offers/closed-fixture')).status, 404);
    assert.equal((await (await fetch(base+'/api/offers?contract=Stage&city=Paris')).json()).total, 1);
    assert.equal((await (await fetch(base+'/api/offers?contract=Apprentissage')).json()).total, 0);
    const refs = await (await fetch(base+'/api/references')).json();
    assert.ok(refs.offers.some(o=>o.id===recent.id));
    assert.ok(!refs.offers.some(o=>o.id==='closed-fixture'));
    assert.equal(selectOffers(variants, defaultFilters).length, 1);
  } finally {
    server.closeAllConnections(); await new Promise(r=>server.close(r)); store.close(); await rm(folder,{recursive:true,force:true});
  }
});
