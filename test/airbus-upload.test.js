import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {airbusReferences} from '../shared/airbus-references.js';
import {AIRBUS_UPLOAD_EVIDENCE} from '../shared/airbus-publication-evidence.js';
import {hasRecentPublication,publicationIndex,relativePublicationWindow} from '../shared/freshness.js';
import {Reports} from '../server/reports.js';
import {selectOffers,defaultFilters} from '../src/domain.js';
test('Airbus uploaded HTML publishes only its 20 captured stages with truthful relative evidence, observed areas and no invented exact dates or missions',async()=>{
 const folder=await mkdtemp('/tmp/airbus-file-test-'),store=new OfferStore(folder);
 try{
  assert.equal(airbusReferences.length,20);
  const seeded=await seedEditorialCatalogue(store,airbusReferences);assert.equal(seeded.created,20);assert.equal(seeded.excluded,0);
  const list=await store.query({query:'Airbus',pageSize:50});assert.equal(list.total,20);
  assert.equal((await store.query({contract:'Stage'})).total,20);
  assert.equal((await store.query({region:'Occitanie'})).total,10);
  assert.equal((await store.query({region:'Île-de-France'})).total,0);
  assert.equal(selectOffers(list.offers,defaultFilters).length,20);
  assert.equal(new Reports(store).references().filter(o=>o.id.startsWith('airbus-')).length,20);
  for(const summary of list.offers){
   const o=await store.getPublic(summary.id),src=airbusReferences.find(r=>r.id===o.id);
   assert.equal(o.company.name,'Airbus');assert.equal(o.contract,'Stage');
   assert.equal(o.publishedAt,null);assert.equal(o.sourcePublishedAt,null);assert.equal(o.startsAt,null);
   assert.equal(o.publicationEvidence.text,'Posted Today');assert.equal(o.publicationEvidence.observationKind,'uploaded-file');
   assert.equal(o.publicationEvidence.observedAt,AIRBUS_UPLOAD_EVIDENCE.observedAt);
   assert.equal(o.location.label,src.location.label);assert.equal(o.location.region,src.location.region);
   assert.equal(o.sourceUrl,src.sourceUrl);assert.equal(o.applicationUrl,src.sourceUrl);
   assert.equal(o.lastVerifiedAt,null);assert.deepEqual(o.missions,[]);assert.deepEqual(o.education,[]);
  }
  assert.equal((await seedEditorialCatalogue(store,airbusReferences)).unchanged,20);
  const stored=await store.getPublic(list.offers[0].id);
  await store.review(stored.id,{action:'withdraw'});await seedEditorialCatalogue(store,airbusReferences);
  assert.equal(await store.getPublic(stored.id),null);
 }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
test('Airbus file relative proof is bounded to its exact records, URL, document and first observation; Today is not a future stage starting date',()=>{
 const source=airbusReferences[0],now=Date.parse(AIRBUS_UPLOAD_EVIDENCE.observedAt);
 assert.equal(hasRecentPublication(source,now),true);
 assert.equal(hasRecentPublication(source,now-1),false);
 assert.equal(hasRecentPublication(source,now+31*86400000),false);
 const window=relativePublicationWindow('Posted Today',AIRBUS_UPLOAD_EVIDENCE.observedAt);
 assert.equal(window.earliest,new Date(now-48*3600000).toISOString());
 assert.equal(publicationIndex(source),window.earliest);
 for(const patch of [{sourceId:'arbitrary-feed'},{id:'airbus-made-up'},{sourceUrl:'https://example.org/job'}, {sourceDocument:{...source.sourceDocument,sha256:'different'}}, {publicationEvidence:{...source.publicationEvidence,observedAt:new Date(now+86400000).toISOString()}}])
  assert.equal(hasRecentPublication({...source,...patch},now+86400000),false);
 assert.match(source.title,/2027/);assert.equal(source.publishedAt,null);
});
