import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {OfferStore} from '../server/store.js';
import {seedCreditAgricoleUpload} from '../server/ingestion/credit-agricole-upload.js';
import {CREDIT_AGRICOLE_OWNER_CONFIRMATION as confirmation, hasOwnerConfirmedCreditAgricoleListing as confirmed} from '../shared/credit-agricole-owner-confirmation.js';
import uploaded from '../config/credit-agricole-pending.json' with {type: 'json'};
import {selectOffers, defaultFilters} from '../src/domain.js';
import {nonComplianceReasons} from '../server/domain.js';

test('confirmed Crédit Agricole batch preserves 122 French records, subsidiaries and update dates; withdrawals and expiry remain enforced', async () => {
  const folder = await mkdtemp('/tmp/ca-test-'), store = new OfferStore(folder);
  try {
    assert.equal((await seedCreditAgricoleUpload(store)).created, 122);
    assert.equal((await store.query({})).total, 122);
    assert.equal((await store.query({contract: 'Stage'})).total, 120);
    assert.equal((await store.query({contract: 'Alternance — type non précisé'})).total, 2);
    const offers = [];
    for (const r of uploaded.offers) {
      const offer = await store.getPublic('credit-agricole-' + r.externalId);
      assert.ok(offer);
      assert.equal(offer.company.name, r.companyName);
      assert.equal(offer.company.logoUrl, r.companyLogoUrl);
      assert.equal(offer.publishedAt, null);
      assert.equal(offer.sourcePublishedAt, null);
      assert.equal(offer.sourceUpdatedAt, r.sourceUpdatedAt);
      assert.equal(offer.sourceDocument.sourceTitle, r.title);
      assert.equal(offer.applicationUrl, r.sourceUrl);
      assert.equal(offer.lastVerifiedAt, null);
      assert.deepEqual(nonComplianceReasons(offer), []);
      offers.push(offer);
    }
    assert.equal(selectOffers(offers, defaultFilters).length, 122);
    assert.equal(new Set(offers.map(o => o.company.id)).size, 7);
    for (const r of uploaded.excluded) assert.equal(await store.getPublic('credit-agricole-' + r.recordId), null);
    const offer = offers[0], time = Date.parse(confirmation.confirmedAt);
    assert.equal(confirmed(offer, time - 1), false);
    assert.equal(confirmed(offer, time + 30 * 86400000), false);
    for (const change of [
      {sourceId: 'another-feed'}, {externalId: 'unknown'},
      {publishedAt: '2026-01-01'}, {sourceUrl: 'https://example.org/job'},
      {sourceDocument: {...offer.sourceDocument, sha256: 'forged'}},
      {editorialConfirmation: {...offer.editorialConfirmation, confirmedAt: new Date(time + 1000).toISOString()}},
    ]) assert.equal(confirmed({...offer, ...change}), false);
    assert.ok(nonComplianceReasons({...offer, sourceClosedAt: '2026-11-03'}).includes('source_closed'));
    assert.equal((await seedCreditAgricoleUpload(store)).existing, 122);
    await store.review(offer.id, {action: 'withdraw'});
    await seedCreditAgricoleUpload(store);
    assert.equal(await store.getPublic(offer.id), null);
    assert.equal((await store.query({})).total, 121);
  } finally {
    store.close();
    await rm(folder, {recursive: true, force: true});
  }
});
