import test from 'node:test';
import assert from 'node:assert/strict';
import {franceTravail} from '../server/france-travail.js';
test('missing configuration returns explicit empty state without network',async()=>{
 const originalId=process.env.FRANCE_TRAVAIL_CLIENT_ID, originalSecret=process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
 delete process.env.FRANCE_TRAVAIL_CLIENT_ID;delete process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
 try {const result=await franceTravail.load();assert.equal(result.status,'unconfigured');assert.deepEqual(result.offers,[]);}
 finally {if(originalId!==undefined)process.env.FRANCE_TRAVAIL_CLIENT_ID=originalId;if(originalSecret!==undefined)process.env.FRANCE_TRAVAIL_CLIENT_SECRET=originalSecret;}
});
test('OAuth and contract source requests normalize without fabricating verification',async()=>{
 const oldFetch=global.fetch, oldId=process.env.FRANCE_TRAVAIL_CLIENT_ID, oldSecret=process.env.FRANCE_TRAVAIL_CLIENT_SECRET;
 process.env.FRANCE_TRAVAIL_CLIENT_ID='test-only';process.env.FRANCE_TRAVAIL_CLIENT_SECRET='test-only';const requests=[];
 global.fetch=async(url,options)=>{requests.push({url,options});return {ok:true,status:200,json:async()=>url.includes('oauth2')?{access_token:'fixture-token'}:{resultats:[{id:'fixture',intitule:'Exemple fictif — démonstration',entreprise:{nom:'Entreprise fictive'},typeContrat:'E2',origineOffre:{urlOrigine:'https://example.org/test'}}]}}};
 try {const result=await franceTravail.load();assert.equal(result.status,'connected');assert.equal(requests.length,4);assert.equal(result.offers.length,1);assert.equal(result.offers[0].lastVerifiedAt,null);assert.equal(result.offers[0].publishedAt,null);assert.ok(requests.slice(1).every(r=>r.options.headers.Authorization==='Bearer fixture-token'));}
 finally {global.fetch=oldFetch;if(oldId===undefined)delete process.env.FRANCE_TRAVAIL_CLIENT_ID;else process.env.FRANCE_TRAVAIL_CLIENT_ID=oldId;if(oldSecret===undefined)delete process.env.FRANCE_TRAVAIL_CLIENT_SECRET;else process.env.FRANCE_TRAVAIL_CLIENT_SECRET=oldSecret;}
});
