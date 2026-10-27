import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import {
  IngestionPipeline,
  normalizeRecord,
} from "../server/ingestion/pipeline.js";
import { parseFeed } from "../server/ingestion/connectors.js";
import { publicAddress, fetchFeed } from "../server/ingestion/http.js";
import { plainText, extractKeywords } from "../server/enrichment.js";
const source = {
  id: "test-only",
  name: "Source fictive de test",
  kind: "json",
  enabled: true,
  authorized: true,
  licenseUrl: "https://example.org/license",
};
const record = () => ({
  externalId: "fiction-1",
  title: "Exemple fictif — démonstration réseau",
  companyName: "Entreprise fictive de test",
  companyWebsite: "https://example.org/",
  sourceUrl: "https://example.org/jobs/1",
  contract: "Stage",
  city: "Nantes",
  region: "Pays de la Loire",
  domain: "Systèmes, réseaux & cloud",
  description:
    "<p>Linux, Docker et TCP/IP — Bac + 3.</p><script>alert(1)</script>prenom.nom@example.org",
  publishedAt: new Date(Date.now() - 86400000).toISOString(),
});
test("normalization cleans HTML and emails, extracts mentions, preserves source timestamps and never verifies automatically", () => {
  const raw = record(),
    offer = normalizeRecord(raw, source);
  assert.equal(offer.sourcePublishedAt, raw.publishedAt);
  assert.equal(offer.lastVerifiedAt, null);
  assert.equal(offer.moderationStatus, "pending");
  assert.deepEqual(offer.publicContacts, []);
  assert.ok(!offer.description.includes("<"));
  assert.ok(!offer.description.includes("prenom.nom@"));
  assert.ok(!offer.description.includes("alert(1)"));
  assert.deepEqual(offer.extractedKeywords.technologies, [
    "Linux",
    "TCP/IP",
    "Docker",
  ]);
  assert.deepEqual(offer.extractedKeywords.education, ["Bac + 3"]);
  assert.equal(offer.company.stack.length, 0);
  assert.throws(() => normalizeRecord({ ...raw, publishedAt: null }, source));
});
test("RSS/Atom parse explicit publication dates and reject XML entity declarations", () => {
  const rss =
    "<rss><channel><item><title>Exemple fictif</title><link>https://example.org/job/1</link><pubDate>Mon, 26 Oct 2026 08:00:00 GMT</pubDate><description>Linux</description></item></channel></rss>";
  const data = parseFeed(
    {
      kind: "rss",
      defaults: { city: "Nantes", companyName: "Entreprise fictive" },
    },
    rss,
  );
  assert.equal(data[0].city, "Nantes");
  assert.equal(data[0].sourceUrl, "https://example.org/job/1");
  assert.ok(data[0].publishedAt.includes("2026"));
  assert.throws(() =>
    parseFeed(
      { kind: "rss" },
      '<!DOCTYPE rss [<!ENTITY test SYSTEM "file:///etc/passwd">]><rss/>',
    ),
  );
});
test("pipeline is idempotent, isolates invalid records, resets changed offers to pending, and preserves first retrieval", async () => {
  const folder = await mkdtemp("/tmp/offres-ingest-"),
    store = new OfferStore(folder);
  let raw = record();
  const pipeline = new IngestionPipeline(store, {
    sources: async () => [source],
    fetcher: async () =>
      JSON.stringify({
        offers: [raw, { ...raw, externalId: "bad", publishedAt: null }],
      }),
  });
  try {
    const first = await pipeline.run();
    assert.equal(first.reports[0].created, 1);
    assert.equal(first.reports[0].invalid, 1);
    const original = (await store.read())[0];
    assert.equal((await store.query()).total, 0);
    const repeated = await pipeline.run();
    assert.equal(repeated.reports[0].unchanged, 1);
    await store.review(original.id, {
      action: "approve",
      sourceChecked: true,
      rightsChecked: true,
      companyChecked: true,
      contactChecked: true,
    });
    assert.equal((await store.query()).total, 1);
    raw = { ...raw, description: "Nouveau contenu fictif : Cisco." };
    const changed = await pipeline.run();
    assert.equal(changed.reports[0].updated, 1);
    const updated = (await store.read())[0];
    assert.equal(updated.firstRetrievedAt, original.firstRetrievedAt);
    assert.equal(updated.lastVerifiedAt, null);
    assert.equal((await store.query()).total, 0);
    assert.equal(store.runs().length, 3);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("unapproved sources are never fetched; one source failure does not stop the next", async () => {
  const folder = await mkdtemp("/tmp/offres-sources-"),
    store = new OfferStore(folder);
  let calls = 0;
  try {
    const pipeline = new IngestionPipeline(store, {
      sources: async () => [
        { ...source, id: "blocked", authorized: false },
        { ...source, id: "failed" },
        source,
      ],
      fetcher: async (s) => {
        calls++;
        if (s.id === "failed") throw new Error("secret must not appear");
        return JSON.stringify({ offers: [record()] });
      },
    });
    const result = await pipeline.run();
    assert.equal(calls, 2);
    assert.deepEqual(
      result.reports.map((r) => r.status),
      ["skipped", "error", "success"],
    );
    assert.ok(!JSON.stringify(result).includes("secret must not appear"));
    assert.equal((await store.query()).total, 0);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("source transport refuses internal addresses and destinations outside an explicit allowlist", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
  ])
    assert.equal(publicAddress(ip), false);
  assert.equal(publicAddress("1.1.1.1"), true);
  await assert.rejects(() =>
    fetchFeed({
      kind: "json",
      url: "https://example.org/feed",
      allowedHosts: ["other.example.org"],
    }),
  );
});

test("location and level extraction remain textual suggestions rather than source fields", () => {
  const extracted = extractKeywords(
    "Stage à Nantes, Bac + 2 ou Bac+3, Linux et Cisco.",
  );
  assert.deepEqual(extracted.locations, ["Nantes"]);
  assert.deepEqual(extracted.education, ["Bac + 2", "Bac + 3"]);
});
