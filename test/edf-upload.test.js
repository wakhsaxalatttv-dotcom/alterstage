import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {plainText} from '../server/enrichment.js';
import {edfReferences} from '../shared/edf-references.js';

test('EDF upload keeps distinct jobs and real employer identities, dates and descriptions; missing pages stay excluded', async () => {
  const folder = await mkdtemp('/tmp/edf-upload-'), store = new OfferStore(folder);
  try {
    const result = await seedEditorialCatalogue(store, edfReferences);
    assert.equal(result.created, 46);
    assert.equal(result.excluded, 0);
    assert.equal(result.duplicate, 0);
    assert.equal((await store.query({contract: 'Stage'})).total, 44);
    assert.equal((await store.query({contract: 'Alternance — type non précisé'})).total, 2);
    assert.deepEqual([...new Set(edfReferences.map(r => r.company.name))].sort(), ['EDF', 'EDF POWER SOLUTIONS', 'Enedis', 'Framatome']);
    for (const ref of edfReferences) {
      const offer = await store.getPublic(ref.id);
      assert.ok(offer);
      assert.equal(offer.company.name, ref.company.name);
      assert.equal(offer.description, plainText(ref.summary));
      assert.equal(offer.publishedAt, ref.publishedAt);
      assert.equal(offer.applicationUrl, ref.sourceUrl);
      assert.ok(offer.publishedAt >= '2026-10-27');
      assert.equal(offer.lastVerifiedAt, null);
      assert.equal(offer.sourceDocument.detailPage.httpStatus, 200);
      assert.equal(offer.sourceDocument.detailPage.applicationEntryObserved, true);
    }
    for (const id of ['FRA-REC-2026-28051', '2026-185582', '2026-185917', '2026-185767']) assert.equal(await store.getPublic('edf-' + id), null);
    const a = await store.getPublic('edf-2026-185914'), b = await store.getPublic('edf-2026-185915');
    assert.notEqual(a.description, b.description);
    assert.notEqual(a.title, b.title);
    assert.equal((await seedEditorialCatalogue(store, edfReferences)).unchanged, 46);
    await store.review(a.id, {action: 'withdraw'});
    await seedEditorialCatalogue(store, edfReferences);
    assert.equal(await store.getPublic(a.id), null);
  } finally {
    store.close();
    await rm(folder, {recursive: true, force: true});
  }
});
