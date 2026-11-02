import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { OfferStore } from '../server/store.js';
import { seedEditorialCatalogue } from '../server/ingestion/editorial-catalogue.js';
import { seedSncfPending } from '../server/ingestion/sncf-upload.js';
import { sncfReferences } from '../shared/sncf-references.js';
import pending from '../config/sncf-pending.json' with { type: 'json' };
import { Reports } from '../server/reports.js';

test('SNCF saved HTML imports only its dated stage, preserving actual metadata and absence of detailed missions or live verification', async () => {
  const folder = await mkdtemp('/tmp/sncf-upload-test-'), store = new OfferStore(folder);
  try {
    assert.equal(sncfReferences.length, 1);
    const report = await seedEditorialCatalogue(store, sncfReferences);
    assert.equal(report.created, 1);
    const offer = await store.getPublic('sncf-886156');
    assert.ok(offer);
    assert.equal(offer.contract, 'Stage');
    assert.equal(offer.publishedAt, '2026-11-02');
    assert.equal(offer.sourcePublishedAt, '2026-11-02T09:48:39+00:00');
    assert.equal(offer.sourceUrl, 'https://emploi.sncf.com/nos-offres/886156');
    assert.equal(offer.duration, '6 mois');
    assert.equal(offer.location.label, 'Saint-Denis');
    assert.deepEqual(offer.education, ['Bac + 5 et plus']);
    assert.deepEqual(offer.missions, []);
    assert.equal(offer.lastVerifiedAt, null);
    assert.equal(offer.sourceDocument.descriptionAvailable, false);
    assert.equal(offer.sourceDocument.onlineAvailabilityChecked, false);
    assert.ok(new Reports(store).references().some(o=>o.id===offer.id));
    assert.equal((await seedEditorialCatalogue(store, sncfReferences)).unchanged, 1);
    await store.review(offer.id, {action:'withdraw'});
    await seedEditorialCatalogue(store, sncfReferences);
    assert.equal(await store.getPublic(offer.id), null);
  } finally { store.close(); await rm(folder,{recursive:true,force:true}); }
});
test('SNCF MHTML keeps its 20 alternances private without replacing missing publication dates with snapshot dates', async () => {
  const folder = await mkdtemp('/tmp/sncf-pending-test-'), store = new OfferStore(folder);
  try {
    assert.equal(pending.totalDisplayed, 32);
    assert.equal(pending.offers.length, 20);
    assert.equal(pending.publicationDatesAvailable, false);
    assert.equal((await seedSncfPending(store)).created, 20);
    assert.equal((await seedSncfPending(store)).existing, 20);
    const rows = await store.read();
    assert.equal(rows.length, 20);
    assert.equal((await store.query()).total, 0);
    for (const o of rows) {
      assert.equal(o.moderationStatus, 'pending');
      assert.equal(o.publishedAt, null);
      assert.equal(o.sourcePublishedAt, null);
      assert.equal(o.lastVerifiedAt, null);
      assert.match(o.sourceUrl,/^https:\/\/emploi\.sncf\.com\/nos-offres\/\d+$/);
      assert.equal(o.sourceDocument.kind,'uploaded-mhtml');
    }
    const contracts = new Set(rows.map(o=>o.contract));
    assert.ok(contracts.has('Alternance — type non précisé'));
    assert.ok(contracts.has('Contrat de professionnalisation'));
    await assert.rejects(store.review(rows[0].id,{action:'approve',sourceChecked:true,rightsChecked:true,companyChecked:true,contactChecked:true}),/date de publication/);
    await store.review(rows[0].id,{action:'withdraw'});
    await seedSncfPending(store);
    assert.equal((await store.read()).find(o=>o.id===rows[0].id).moderationStatus,'withdrawn');
  } finally {store.close();await rm(folder,{recursive:true,force:true});}
});
