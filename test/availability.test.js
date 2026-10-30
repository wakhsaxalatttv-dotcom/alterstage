import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { closureEvidence, auditAvailability } from "../server/ingestion/availability.js";
import { Reports } from "../server/reports.js";

test("only explicit page closure or gone/not-found withdraws a vacancy", () => {
  for (const text of ["Cette offre n’est plus disponible", "Cette annonce est clôturée", "This job has expired", "Cette offre a été pourvue"])
    assert.ok(closureEvidence(200, `<main>${text}</main>`));
  assert.ok(closureEvidence(404));
  assert.ok(closureEvidence(410));
  assert.equal(closureEvidence(403, "Cette offre est clôturée"), null);
  assert.equal(closureEvidence(200, '<script>"Cette offre est clôturée"</script><h1>Stage ouvert</h1>'), null);
  assert.equal(closureEvidence(200, "Nous analysons pourquoi une offre est clôturée."), null);
});

test("closed pages disappear from offers and repérées, survive reingestion; inconclusive checks keep the vacancy unverified", async () => {
  const folder = await mkdtemp('/tmp/availability-test-'), store = new OfferStore(folder);
  try {
    const snapshot = JSON.parse(await readFile(new URL('../config/market-offers.json', import.meta.url)));
    const [closed, unknown] = structuredClone(snapshot.offers.slice(0, 2));
    for (const [i, o] of [closed, unknown].entries()) {
      o.sourceUrl = o.applicationUrl = `https://example.org/availability-fixture-${i}`;
      await store.ingest(o);
    }
    const now = Date.now();
    const result = await auditAvailability(store, { now, check: async (url) => url === closed.applicationUrl ? { state: 'closed', evidence: 'HTTP 410' } : { state: 'unknown' } });
    assert.equal(result.closed, 1);
    const stored = JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(closed.id).payload);
    assert.equal(stored.moderationStatus, 'withdrawn');
    assert.ok(stored.sourceClosedAt);
    assert.equal(new Reports(store).references().some((o) => o.id === closed.id), false);
    const retained = JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(unknown.id).payload);
    assert.equal(retained.moderationStatus, 'approved');
    assert.equal(retained.lastVerifiedAt, null);
    await store.ingest({ ...closed, contentHash: 'changed-after-closure', lastFetchedAt: new Date(now + 1000).toISOString() });
    assert.equal(JSON.parse(store.db.prepare('SELECT payload FROM offers WHERE id=?').get(closed.id).payload).moderationStatus, 'withdrawn');
    assert.equal((await auditAvailability(store, { now: now + 1000, check: async () => { throw Error('must respect cooldown'); } })).checked, 0);
  } finally { store.close(); await rm(folder, { recursive: true, force: true }); }
});
