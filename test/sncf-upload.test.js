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
test('explicit owner confirmation publishes all 20 captured alternances without inventing publication dates or human review badges', async () => {
  const folder = await mkdtemp('/tmp/sncf-pending-test-'), store = new OfferStore(folder);
  try {
    assert.equal(pending.totalDisplayed, 32);
    assert.equal(pending.offers.length, 20);
    assert.equal(pending.publicationDatesAvailable, false);
    assert.equal((await seedSncfPending(store)).created, 20);
    assert.equal((await seedSncfPending(store)).existing, 20);
    const rows = await store.read();
    assert.equal(rows.length, 20);
    assert.equal((await store.query()).total, 20);
    for (const o of rows) {
      assert.equal(o.moderationStatus, 'approved');
      assert.equal(o.editorialConfirmation.kind, 'owner-confirmation');
      assert.equal(o.publishedAt, null);
      assert.equal(o.sourcePublishedAt, null);
      assert.equal(o.lastVerifiedAt, null);
      assert.match(o.sourceUrl,/^https:\/\/emploi\.sncf\.com\/nos-offres\/\d+$/);
      assert.equal(o.sourceDocument.kind,'uploaded-mhtml');
    }
    assert.equal(new Set(rows.map(o=>o.company.id)).size, 4);
    assert.equal((await store.query({age:"7"})).total, 0);
    assert.equal(new Reports(store).references().filter(o=>o.sourceId==='sncf-upload').length,20);
    const contracts = new Set(rows.map(o=>o.contract));
    assert.ok(contracts.has('Alternance — type non précisé'));
    assert.ok(contracts.has('Contrat de professionnalisation'));
    await assert.rejects(store.review(rows[0].id,{action:'approve',sourceChecked:true,rightsChecked:true,companyChecked:true,contactChecked:true}),/date de publication/);
    await store.review(rows[0].id,{action:'withdraw'});
    await seedSncfPending(store);
    assert.equal((await store.read()).find(o=>o.id===rows[0].id).moderationStatus,'withdrawn');
  } finally {store.close();await rm(folder,{recursive:true,force:true});}
});

test('owner exception is bounded to the supplied SNCF records, expires without refreshing on restart, and never overrides known closure or known publication age', async () => {
  const folder = await mkdtemp('/tmp/sncf-owner-scope-'), store = new OfferStore(folder);
  try {
    await seedSncfPending(store);
    const offer=(await store.read())[0];
    const { publicOffer } = await import('../server/domain.js');
    const { selectOffers, defaultFilters } = await import('../src/domain.js');
    const { hasOwnerConfirmedSncfListing, SNCF_OWNER_CONFIRMATION } = await import('../shared/sncf-owner-confirmation.js');
    const { publicationIndex, hasRecentPublication } = await import('../shared/freshness.js');
    const time=Date.parse(SNCF_OWNER_CONFIRMATION.confirmedAt);
    assert.equal(publicationIndex(offer),null);
    assert.equal(hasRecentPublication(offer,time),false);
    assert.equal(hasOwnerConfirmedSncfListing(offer,time),true);
    assert.equal(hasOwnerConfirmedSncfListing(offer,time-1),false);
    assert.equal(hasOwnerConfirmedSncfListing(offer,time+30*86400000),false);
    assert.ok(publicOffer(offer,time));
    assert.equal(publicOffer(offer,time+30*86400000),null);
    assert.equal(selectOffers([offer],defaultFilters,time).length,1);
    assert.equal(publicOffer({...offer,sourceClosedAt:new Date(time).toISOString()},time),null);
    assert.equal(publicOffer({...offer,publishedAt:'2020-01-01',sourcePublishedAt:'2020-01-01'},time),null);
    for(const change of [{sourceId:'random-feed'},{id:'sncf-unknown',externalId:'unknown'},{sourceUrl:'https://example.org/job'},{sourceDocument:{...offer.sourceDocument,sha256:'different'}}])
      assert.equal(hasOwnerConfirmedSncfListing({...offer,...change},time),false);
    assert.equal(publicOffer({...offer,moderationStatus:'withdrawn',status:'withdrawn'},time),null);
  } finally {store.close();await rm(folder,{recursive:true,force:true});}
});
