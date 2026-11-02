import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {totalEnergiesReferences} from '../shared/totalenergies-references.js';
import {normalizeSubmission,nonComplianceReasons} from '../server/domain.js';
import {Reports} from '../server/reports.js';
import {selectOffers,defaultFilters} from '../src/domain.js';
test('TotalEnergies HTML adds its 20 dated French stages, preserves exact application URLs and company identities without inventing a city or missions',async()=>{
 const folder=await mkdtemp('/tmp/total-upload-test-'),store=new OfferStore(folder);
 try{
  assert.equal(totalEnergiesReferences.length,20);
  assert.equal(new Set(totalEnergiesReferences.map(o=>o.id)).size,20);
  const seeded=await seedEditorialCatalogue(store,totalEnergiesReferences);assert.equal(seeded.created,20);assert.equal(seeded.excluded,0);
  const result=await store.query({pageSize:50});assert.equal(result.total,20);
  assert.equal((await store.query({query:'TotalEnergies'})).total,20);
  assert.equal(new Set(result.offers.map(o=>o.company.id)).size,8);
  assert.equal((await store.query({contract:'Stage'})).total,20);
  assert.equal((await store.query({region:'Île-de-France'})).total,0);
  assert.equal((await store.query({city:'Paris'})).total,0);
  assert.equal(new Reports(store).references().filter(o=>o.id.startsWith('totalenergies-')).length,20);
  assert.equal(selectOffers(result.offers,defaultFilters).length,20);
  for(const summary of result.offers){
   const o=await store.getPublic(summary.id),source=totalEnergiesReferences.find(r=>r.id===o.id);
   assert.equal(o.contract,'Stage');assert.equal(o.publishedAt,source.publishedAt);
   assert.equal(o.sourcePublishedAt,source.publishedAt);assert.equal(o.company.name,source.company.name);
   assert.equal(o.location.label,'France');assert.equal(o.location.region,'');assert.equal(o.location.commune,null);
   assert.equal(o.location.countryCode,'FR');assert.equal(o.location.precision,'country');
   assert.equal(o.applicationUrl,source.applicationUrl);assert.match(o.applicationUrl,/\/ApplicationMethods\?jobId=\d+$/);
   assert.equal(o.lastVerifiedAt,null);assert.deepEqual(o.missions,[]);
   assert.equal(o.sourceDocument.descriptionAvailable,false);assert.equal(o.sourceDocument.onlineAvailabilityChecked,false);
   assert.equal(nonComplianceReasons(o).length,0);
  }
  assert.equal((await seedEditorialCatalogue(store,totalEnergiesReferences)).unchanged,20);
  await store.review(result.offers[0].id,{action:'withdraw'});await seedEditorialCatalogue(store,totalEnergiesReferences);
  assert.equal(await store.getPublic(result.offers[0].id),null);
 }finally{store.close();await rm(folder,{recursive:true,force:true});}
});
test('country-only France needs an explicit trusted import option and never admits a foreign or fabricated location',()=>{
 const r=totalEnergiesReferences[0];
 const body={title:r.title,companyName:r.company.name,companyWebsite:r.companyWebsite,sourceUrl:r.sourceUrl,city:'France',countryCode:'FR',region:'',domain:r.domain,contract:'Stage',description:r.summary,publishedAt:r.publishedAt,expiresAt:new Date(Date.now()+7*86400000).toISOString().slice(0,10),consent:true};
 assert.throws(()=>normalizeSubmission(body),/région française/);
 const valid=normalizeSubmission(body,{allowCountryOnlyLocation:true});assert.equal(valid.location.precision,'country');
 assert.throws(()=>normalizeSubmission({...body,countryCode:'BE'},{allowCountryOnlyLocation:true}),/région française/);
 assert.throws(()=>normalizeSubmission({...body,city:'Bruxelles'},{allowCountryOnlyLocation:true}),/région française/);
 assert.ok(nonComplianceReasons({...valid,location:{...valid.location,countryCode:'BE'}}).includes('location_not_established_in_france'));
 assert.ok(nonComplianceReasons({...valid,location:{...valid.location,label:'Paris'}}).includes('location_not_established_in_france'));
});
