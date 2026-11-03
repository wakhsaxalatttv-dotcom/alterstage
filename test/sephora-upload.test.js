import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {sephoraReferences} from '../shared/sephora-references.js';
import {externalOffers} from '../shared/external-offers.js';

test('Sephora listing imports recent French stages across sectors, preserves provenance, and respects withdrawals', async () => {
  const folder = await mkdtemp('/tmp/sephora-upload-');
  const store = new OfferStore(folder);
  try {
    assert.equal(sephoraReferences.length, 27);
    assert.equal(new Set(sephoraReferences.map(o => o.id)).size, 27);
    assert.ok(sephoraReferences.every(o => externalOffers.some(r => r.id === o.id)));
    const seeded = await seedEditorialCatalogue(store, sephoraReferences);
    assert.equal(seeded.created, 27);
    assert.equal(seeded.excluded, 0);
    assert.equal((await store.query({query: 'Sephora'})).total, 27);
    assert.equal((await store.query({domain: 'Ressources humaines'})).total, 1);
    assert.equal((await store.query({domain: 'Droit & administration'})).total, 1);
    assert.equal((await store.query({region: 'Centre-Val de Loire'})).total, 1);
    assert.equal(await store.getPublic('sephora-296955'), null);
    for (const ref of sephoraReferences) {
      const offer = await store.getPublic(ref.id);
      assert.equal(offer.contract, 'Stage');
      assert.equal(offer.publishedAt, ref.publishedAt);
      assert.ok(offer.publishedAt >= '2026-10-04');
      assert.equal(offer.applicationUrl, ref.sourceUrl);
      assert.match(offer.applicationUrl, /^https:\/\/www\.inside-sephora\.com\/fr\/france\/jobs\//);
      assert.equal(offer.lastVerifiedAt, null);
      assert.deepEqual(offer.missions, []);
      assert.equal(offer.sourceDocument.descriptionAvailable, false);
      assert.equal(offer.sourceDocument.onlineAvailabilityChecked, false);
    }
    assert.equal((await seedEditorialCatalogue(store, sephoraReferences)).unchanged, 27);
    const id = sephoraReferences[0].id;
    await store.review(id, {action: 'withdraw'});
    await seedEditorialCatalogue(store, sephoraReferences);
    assert.equal(await store.getPublic(id), null);
  } finally {
    store.close();
    await rm(folder, {recursive: true, force: true});
  }
});
