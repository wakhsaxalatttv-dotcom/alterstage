import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedRteUpload} from '../server/ingestion/rte-upload.js';
import {RTE_OWNER_CONFIRMATION, hasOwnerConfirmedRteListing} from '../shared/rte-owner-confirmation.js';
import {nonComplianceReasons} from '../server/domain.js';
import {selectOffers, defaultFilters} from '../src/domain.js';
import {Reports} from '../server/reports.js';

test('owner-confirmed Rte stages appear in API and frontend without invented dates and cannot override closure or withdrawals', async () => {
  const folder = await mkdtemp('/tmp/rte-upload-'), store = new OfferStore(folder);
  try {
    const first = await seedRteUpload(store);
    assert.equal(first.created, 21);
    assert.equal(first.invalid, 0);
    const list = await store.query({query: 'Rte', pageSize: 50});
    assert.equal(list.total, 21);
    assert.equal(selectOffers(list.offers, defaultFilters).length, 21);
    assert.equal(new Reports(store).references().filter(o => o.sourceId === 'rte-upload').length, 21);
    for (const offer of list.offers) {
      assert.equal(offer.publishedAt, null);
      assert.equal(offer.sourcePublishedAt, null);
      assert.equal(offer.lastVerifiedAt, null);
      assert.equal(offer.sourceDocument.onlineAvailabilityChecked, false);
      assert.match(offer.location.label, /\(\d+\)/);
      assert.equal(offer.company.website, 'https://www.rte-france.com/');
      assert.equal(offer.contract, 'Stage');
      assert.equal(offer.applicationUrl, offer.sourceUrl);
      assert.ok(hasOwnerConfirmedRteListing(offer));
      assert.deepEqual(nonComplianceReasons(offer), []);
    }
    const offer = list.offers[0], now = Date.parse(RTE_OWNER_CONFIRMATION.confirmedAt);
    assert.equal(hasOwnerConfirmedRteListing(offer, now - 1), false);
    assert.equal(hasOwnerConfirmedRteListing(offer, now + 30 * 86400000), false);
    for (const change of [
      {sourceId: 'another-feed'}, {id: 'rte-forged'},
      {sourceUrl: 'https://example.org/job'},
      {publishedAt: '2026-01-01'},
      {sourceDocument: {...offer.sourceDocument, sha256: 'forged'}},
      {editorialConfirmation: {...offer.editorialConfirmation, confirmedAt: new Date(now + 1000).toISOString()}},
    ]) assert.equal(hasOwnerConfirmedRteListing({...offer, ...change}), false);
    assert.ok(nonComplianceReasons({...offer, sourceClosedAt: '2026-11-03'}).includes('source_closed'));
    assert.equal((await seedRteUpload(store)).existing, 21);
    await store.review(offer.id, {action: 'withdraw'});
    await seedRteUpload(store);
    assert.equal(await store.getPublic(offer.id), null);
    assert.equal((await store.query({query: 'Rte', pageSize: 50})).total, 20);
  } finally {
    store.close();
    await rm(folder, {recursive: true, force: true});
  }
});
