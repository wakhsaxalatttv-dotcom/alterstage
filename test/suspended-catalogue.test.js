import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { OfferStore } from '../server/store.js';
import { seedBundledCatalogue } from '../server/ingestion/bundled.js';
import { isSuspendedImport } from '../server/suspended-catalogue.js';
import { Reports } from '../server/reports.js';
test('reported batch is removed on restart and cannot be reimported or reseeded', async () => {
  const folder = await mkdtemp('/tmp/suspended-import-');
  let store = new OfferStore(folder);
  try {
    const snapshot = JSON.parse(await readFile(new URL('../config/market-offers.json', import.meta.url)));
    assert.equal(snapshot.publicationSuspended, true);
    const offer = structuredClone(snapshot.offers[0]);
    store.writeOffer(offer); // Simulate the already-published database before maintenance.
    store.close();
    store = new OfferStore(folder);
    assert.equal((await store.query()).total, 0);
    assert.equal(new Reports(store).references().some((o) => o.sourceUrl === offer.sourceUrl), false);
    assert.equal(JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(offer.id).payload).moderationStatus, 'withdrawn');
    assert.equal(await store.ingest({ ...offer, externalId: 'different-provider-id' }), 'invalid');
    await seedBundledCatalogue(store);
    assert.equal((await store.query()).total, 0);
    const url = new URL(offer.sourceUrl);
    url.searchParams.set('utm_source', 'another-source');
    url.searchParams.delete('source');
    assert.equal(isSuspendedImport({ sourceUrl: url.href }), true);
  } finally { store.close(); await rm(folder, { recursive: true, force: true }); }
});
