import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedToyotaUpload} from '../server/ingestion/toyota-upload.js';
import {TOYOTA_OWNER_CONFIRMATION, hasOwnerConfirmedToyotaListing} from '../shared/toyota-owner-confirmation.js';
import {nonComplianceReasons} from '../server/domain.js';
import {selectOffers, defaultFilters} from '../src/domain.js';
import {Reports} from '../server/reports.js';

test('owner-confirmed Toyota stages appear in API and frontend without invented dates and cannot override closure or withdrawals', async () => {
  const folder = await mkdtemp('/tmp/toyota-upload-'), store = new OfferStore(folder);
  try {
    const first = await seedToyotaUpload(store);
    assert.equal(first.created, 9);
    assert.equal(first.invalid, 0);
    const list = await store.query({query: 'Toyota'});
    assert.equal(list.total, 9);
    assert.equal(selectOffers(list.offers, defaultFilters).length, 9);
    assert.equal(new Reports(store).references().filter(o => o.sourceId === 'toyota-upload').length, 9);
    for (const offer of list.offers) {
      assert.equal(offer.publishedAt, null);
      assert.equal(offer.sourcePublishedAt, null);
      assert.equal(offer.lastVerifiedAt, null);
      assert.equal(offer.sourceDocument.onlineAvailabilityChecked, false);
      assert.equal(offer.location.label, 'Onnaing');
      assert.equal(offer.contract, 'Stage');
      assert.equal(offer.applicationUrl, offer.sourceUrl);
      assert.ok(hasOwnerConfirmedToyotaListing(offer));
      assert.deepEqual(nonComplianceReasons(offer), []);
    }
    const offer = list.offers[0], now = Date.parse(TOYOTA_OWNER_CONFIRMATION.confirmedAt);
    assert.equal(hasOwnerConfirmedToyotaListing(offer, now - 1), false);
    assert.equal(hasOwnerConfirmedToyotaListing(offer, now + 30 * 86400000), false);
    for (const change of [
      {sourceId: 'another-feed'}, {id: 'toyota-forged'},
      {sourceUrl: 'https://example.org/job'},
      {publishedAt: '2026-01-01'},
      {sourceDocument: {...offer.sourceDocument, sha256: 'forged'}},
      {editorialConfirmation: {...offer.editorialConfirmation, confirmedAt: new Date(now + 1000).toISOString()}},
    ]) assert.equal(hasOwnerConfirmedToyotaListing({...offer, ...change}), false);
    assert.ok(nonComplianceReasons({...offer, sourceClosedAt: '2026-11-03'}).includes('source_closed'));
    assert.equal((await seedToyotaUpload(store)).existing, 9);
    await store.review(offer.id, {action: 'withdraw'});
    await seedToyotaUpload(store);
    assert.equal(await store.getPublic(offer.id), null);
    assert.equal((await store.query({query: 'Toyota'})).total, 8);
  } finally {
    store.close();
    await rm(folder, {recursive: true, force: true});
  }
});
