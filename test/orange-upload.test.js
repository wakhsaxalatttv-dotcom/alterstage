import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {orangeReferences} from '../shared/orange-references.js';
import {Reports} from '../server/reports.js';
import {selectOffers,defaultFilters} from '../src/domain.js';
test('Orange files add 10 French stages and one explicit alternance with original creation dates, exact source/apply links and supplied summaries',async()=>{
 const folder=await mkdtemp('/tmp/orange-upload-test-'),store=new OfferStore(folder);
 try{
  assert.equal(orangeReferences.length,11);
  assert.equal(new Set(orangeReferences.map(o=>o.id)).size,11);
  const seeded=await seedEditorialCatalogue(store,orangeReferences);assert.equal(seeded.created,11);assert.equal(seeded.excluded,0);
  const list=await store.query({query:'Orange',pageSize:50});assert.equal(list.total,11);
  assert.equal((await store.query({contract:'Stage'})).total,10);
  assert.equal((await store.query({contract:'Alternance — type non précisé'})).total,1);
  assert.equal((await store.query({contract:'Apprentissage'})).total,0);
  assert.equal((await store.query({region:'Île-de-France'})).total,6);
  assert.equal((await store.query({domain:'Marketing & communication'})).total,3);
  assert.equal(new Set(list.offers.map(o=>o.company.id)).size,2);
  assert.equal(new Reports(store).references().filter(o=>o.id.startsWith('orange-')).length,11);
  assert.equal(selectOffers(list.offers,defaultFilters).length,11);
  for(const summary of list.offers){const o=await store.getPublic(summary.id),src=orangeReferences.find(r=>r.id===o.id);
   assert.equal(o.publishedAt,src.publishedAt);assert.equal(o.sourcePublishedAt,src.sourcePublishedAt);
   assert.equal(o.sourcePortalPostedAt,src.sourcePortalPostedAt);
   assert.equal(o.description,src.summary);assert.deepEqual(o.missions,[]);assert.deepEqual(o.education,[]);
   assert.equal(o.sourceUrl,src.sourceUrl);assert.equal(o.applicationUrl,src.applicationUrl);
   assert.equal(o.location.label,src.location.label);assert.equal(o.location.region,src.location.region);
   assert.equal(o.lastVerifiedAt,null);assert.equal(o.sourceDocument.onlineAvailabilityChecked,false);
  }
  const oldStage=await store.getPublic('orange-CTS-2026-54624');assert.equal(oldStage.publishedAt,'2026-10-08');assert.match(oldStage.sourcePortalPostedAt,/^2026-11-02/);
  const alt=await store.getPublic('orange-IOS-2026-2784');assert.equal(alt.publishedAt,'2026-10-19');assert.equal(alt.company.name,'Orange Cyberdefense');
  assert.match(alt.applicationUrl,/^https:\/\/careers-jobin\.icims\.com\/jobs\/2784\//);
  assert.ok(!list.offers.some(o=>o.title==='Ingénieur support infrastructure (H/F)'));
  assert.equal((await seedEditorialCatalogue(store,orangeReferences)).unchanged,11);
  await store.review(alt.id,{action:'withdraw'});await seedEditorialCatalogue(store,orangeReferences);assert.equal(await store.getPublic(alt.id),null);
 }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
