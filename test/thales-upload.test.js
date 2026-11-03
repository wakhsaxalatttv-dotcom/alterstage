import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {thalesReferences} from '../shared/thales-references.js';
import {Reports} from '../server/reports.js';
test('Thales upload adds only the dated French stages, preserves exact Workday application and supplied teaser, and respects withdrawals',async()=>{
 const folder=await mkdtemp('/tmp/thales-upload-test-'),store=new OfferStore(folder);
 try{
  assert.equal(thalesReferences.length,11);
  const seeded=await seedEditorialCatalogue(store,thalesReferences);assert.equal(seeded.created,11);assert.equal(seeded.excluded,0);
  const list=await store.query({query:'Thales'});assert.equal(list.total,11);
  assert.equal((await store.getPublic('thales-R0342095')).publishedAt,'2026-10-12');
  assert.equal((await store.getPublic('thales-R0341959')).publishedAt,'2026-10-13');
  assert.equal(await store.getPublic('thales-R0341211'),null);
  assert.equal(await store.getPublic('thales-R0339361'),null);
  assert.equal(await store.getPublic('thales-R0345757'),null);
  const banc=await store.getPublic('thales-R0344084');
  assert.equal(banc.publishedAt,'2026-10-21');
  assert.equal(banc.sourcePortalPostedAt,'2026-10-30T00:00:00.000Z');
  assert.match(banc.applicationUrl,/R0344084-1\/apply$/);
  assert.equal((await store.query({domain:'Transport & logistique'})).total,1);
  for(const ref of thalesReferences){
   const offer=await store.getPublic(ref.id);
   assert.equal(offer.company.logoUrl,ref.companyLogoUrl);
   assert.equal(offer.description,ref.summary);
   assert.equal(offer.lastVerifiedAt,null);
  }
  const o=await store.getPublic('thales-R0343494');
  assert.equal(o.contract,'Stage');assert.equal(o.publishedAt,'2026-10-14');assert.equal(o.sourcePublishedAt,'2026-10-14T14:54:45.045Z');
  assert.equal(o.sourcePortalPostedAt,'2026-10-14T00:00:00.000Z');
  assert.equal(o.location.label,'Élancourt');assert.equal(o.location.region,'Île-de-France');
  assert.equal(o.description,thalesReferences[0].summary);assert.deepEqual(o.missions,[]);assert.deepEqual(o.education,[]);assert.equal(o.duration,null);
  assert.equal(o.company.name,'Thales');assert.equal(o.company.logoUrl,thalesReferences[0].companyLogoUrl);
  assert.equal(o.sourceUrl,thalesReferences[0].sourceUrl);assert.equal(o.applicationUrl,o.sourceUrl);assert.match(o.applicationUrl,/R0343494-1\/apply$/);
  assert.equal(o.lastVerifiedAt,null);assert.equal(o.sourceDocument.onlineAvailabilityChecked,false);
  assert.equal((await store.query({region:'Île-de-France',contract:'Stage'})).total,5);
  assert.equal((await store.query({contract:'Apprentissage'})).total,0);
  assert.ok(new Reports(store).references().some(r=>r.id===o.id));
  assert.equal((await seedEditorialCatalogue(store,thalesReferences)).unchanged,11);
  await store.review(o.id,{action:'withdraw'});await seedEditorialCatalogue(store,thalesReferences);assert.equal(await store.getPublic(o.id),null);
 }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
