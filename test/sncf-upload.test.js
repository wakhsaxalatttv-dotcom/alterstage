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
test('explicit owner confirmations publish all captured alternances and stages without inventing dates or duplicating the known stage', async () => {
  const folder = await mkdtemp('/tmp/sncf-pending-test-'), store = new OfferStore(folder);
  try {
    assert.equal(pending.totalDisplayed, 32);
    assert.equal(pending.offers.length, 20);
    assert.equal(pending.publicationDatesAvailable, false);
    assert.equal((await seedSncfPending(store)).created, 39);
    assert.equal((await seedSncfPending(store)).existing, 40);
    const rows = await store.read();
    assert.equal(rows.length, 40);
    assert.equal((await store.query()).total, 40);
    for (const o of rows.filter(o=>o.sourceId==='sncf-upload')) {
      assert.equal(o.moderationStatus, 'approved');
      assert.equal(o.editorialConfirmation.kind, 'owner-confirmation');
      assert.equal(o.publishedAt, null);
      assert.equal(o.sourcePublishedAt, null);
      assert.equal(o.lastVerifiedAt, null);
      assert.match(o.sourceUrl,/^https:\/\/emploi\.sncf\.com\/nos-offres\/\d+$/);
      assert.equal(o.sourceDocument.kind,'uploaded-mhtml');
    }
    assert.equal(new Set(rows.map(o=>o.company.id)).size, 5);
    assert.equal((await store.query({age:"7"})).total, 1);
    assert.equal(new Reports(store).references().filter(o=>o.sourceId==='sncf-upload').length,39);
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
    const offer=(await store.read()).find(o=>o.externalId===pending.offers[0].externalId);
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

test('stage upload adds all 20 saved stage cards across sectors, retains the original known publication and uses independent batch confirmation', async () => {
  const folder=await mkdtemp('/tmp/sncf-stages-batch-'),store=new OfferStore(folder);
  try{
    await seedEditorialCatalogue(store,sncfReferences);
    const before=await store.getPublic('sncf-886156');
    await seedSncfPending(store);
    const list=await store.query({contract:'Stage',pageSize:50});
    assert.equal(list.total,20);
    assert.equal((await store.getPublic('sncf-886156')).publishedAt,before.publishedAt);
    assert.equal((await store.read()).filter(o=>o.id==='sncf-886156').length,1);
    const lawyer=await store.getPublic('sncf-687444');
    const hr=await store.getPublic('sncf-819502');
    assert.equal(lawyer.domain,'Droit & administration');
    assert.equal(hr.domain,'Ressources humaines');
    assert.equal(hr.duration,'6 mois');
    const {SNCF_STAGE_CONFIRMATION,SNCF_OWNER_CONFIRMATION,hasOwnerConfirmedSncfListing}=await import('../shared/sncf-owner-confirmation.js');
    assert.equal(lawyer.editorialConfirmation.confirmedAt,SNCF_STAGE_CONFIRMATION.confirmedAt);
    assert.equal(lawyer.publishedAt,null);
    const alternance=await store.getPublic('sncf-'+pending.offers[0].externalId);
    assert.equal(alternance.editorialConfirmation.confirmedAt,SNCF_OWNER_CONFIRMATION.confirmedAt);
    assert.equal(hasOwnerConfirmedSncfListing({...lawyer,sourceDocument:alternance.sourceDocument}),false);
  }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
