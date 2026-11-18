import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedCollectedEmployers, hasEmployerApplicationObservation} from '../server/ingestion/collected-employers.js';
import {seedEditorialCatalogue} from '../server/ingestion/editorial-catalogue.js';
import {edfReferences} from '../shared/edf-references.js';

const snapshot = JSON.parse(await readFile(new URL('../config/collected-employers.json', import.meta.url), 'utf8'));

test('current employer collection imports 368 dated French roles, keeps provenance and human withdrawals, and does not renew observation times', async () => {
  const folder = await mkdtemp('/tmp/current-employers-'), store = new OfferStore(folder);
  try {
    const result = await seedCollectedEmployers(store);
    assert.equal(result.created, 368);
    assert.equal(result.invalidEvidence, 0);
    assert.equal(result.excluded, 0);
    assert.equal((await store.query({})).total, 368);
    for (const ref of snapshot.references) {
      const offer = await store.getPublic(ref.id);
      assert.ok(offer);
      assert.equal(offer.publishedAt, ref.publishedAt);
      assert.equal(offer.lastVerifiedAt, null);
      assert.equal(offer.sourceDocument.applicationEntry.checkedAt, ref.sourceConsultedAt);
      assert.ok(hasEmployerApplicationObservation(ref));
      assert.equal(offer.applicationUrl, ref.sourceUrl);
    }
    assert.equal((await seedCollectedEmployers(store)).unchanged, 368);
    const id = snapshot.references[0].id;
    await store.review(id, {action: 'withdraw'});
    await seedCollectedEmployers(store);
    assert.equal(await store.getPublic(id), null);
  } finally { store.close(); await rm(folder, {recursive: true, force: true}); }
});

test('collection rejects missing, future, wrong-identity and blocked-source application observations', () => {
  const ref = snapshot.references[0];
  assert.equal(hasEmployerApplicationObservation(ref, Date.parse(ref.sourceConsultedAt) + 31 * 86400000), false);
  for (const patch of [
    {httpStatus: 404}, {jobIdentityMatched: false}, {applicationActionFound: false},
    {jobPageId: 'another-role'}, {checkedAt: new Date(Date.now() + 86400000).toISOString()},
    {href: 'https://www.meteojob.com/job/123'},
  ]) assert.equal(hasEmployerApplicationObservation({...ref, sourceDocument: {...ref.sourceDocument, applicationEntry: {...ref.sourceDocument.applicationEntry, ...patch}}}), false);
  assert.equal(hasEmployerApplicationObservation({...ref, sourceDocument: null}), false);
  assert.equal(hasEmployerApplicationObservation({...ref, sourceUrl: 'https://example.org/job'}), false);
});

test('known initial dates are preserved and observed HTTP 404 withdrawals remain durable', async () => {
  const folder = await mkdtemp('/tmp/current-employer-history-'), store = new OfferStore(folder);
  try {
    const ref = snapshot.references[0];
    await seedEditorialCatalogue(store, [{...ref, publishedAt: '2026-10-25', sourcePublishedAt: '2026-10-25'}]);
    await seedCollectedEmployers(store);
    assert.equal((await store.getPublic(ref.id)).publishedAt, '2026-10-25');
    const closed = edfReferences.find(r => snapshot.closed.some(c => c.sourceUrl === r.sourceUrl));
    assert.ok(closed);
    await seedEditorialCatalogue(store, [closed]);
    assert.ok(await store.getPublic(closed.id));
    assert.equal((await seedCollectedEmployers(store)).withdrawn, 1);
    const withdrawn = JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(closed.id).payload);
    assert.ok(withdrawn.sourceClosedAt);
    assert.match(withdrawn.reviewNote, /HTTP 404/);
    await seedEditorialCatalogue(store, [closed]);
    assert.equal(await store.getPublic(closed.id), null);
  } finally { store.close(); await rm(folder, {recursive: true, force: true}); }
});
