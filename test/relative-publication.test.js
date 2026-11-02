import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import {
  SerpApiInbox,
  parseSerpCandidate,
  serpExclusionReason,
} from "../server/ingestion/serpapi-inbox.js";
import {
  relativePublicationWindow,
  hasRecentPublication,
  publicationIndex,
} from "../shared/freshness.js";
import { defaultFilters, selectOffers } from "../src/domain.js";
const observedAt = new Date().toISOString(),
  now = Date.parse(observedAt);
const proof = (text) => ({
  sourceId: "serpapi-google-jobs",
  publishedAt: null,
  sourcePublishedAt: null,
  publicationEvidence: { kind: "relative", text, observedAt },
});
const job = () => ({
  title: "Alternance robotique — exemple fictif",
  company_name: "Entreprise fictive",
  location: "Paris, France",
  description: "Offre fictive : robotique et Linux. contact@example.org",
  source_link: "https://example.org/job/relative",
  extensions: ["il y a 3 jours", "Temps plein"],
});
const geo = async () => ({
  city: "Paris",
  region: "Île-de-France",
  commune: "75056",
  provenance: "https://geo.api.gouv.fr/decoupage-administratif/communes",
});
test("relative French and English source labels yield conservative intervals without inventing publication dates", () => {
  for (const text of [
    "il y a 3 jours",
    "3 days ago",
    "Posted 2 hours ago",
    "il y a 15 minutes",
    "2 weeks ago",
  ]) {
    const window = relativePublicationWindow(text, observedAt);
    assert.ok(window, text);
    assert.ok(Date.parse(window.earliest) <= Date.parse(window.latest));
    assert.ok(hasRecentPublication(proof(text), now), text);
  }
  for (const text of [
    "il y a 46 jours",
    "il y a 1 mois",
    "2 months ago",
    "30+ days ago",
    "recent",
    "dans 3 jours",
    "2026-10-29",
  ])
    assert.equal(hasRecentPublication(proof(text), now), false, text);
  assert.equal(
    hasRecentPublication(
      { ...proof("3 days ago"), sourceId: "untrusted-feed" },
      now,
    ),
    false,
  );
  assert.equal(
    hasRecentPublication(
      {
        ...proof("3 days ago"),
        publicationEvidence: {
          kind: "relative",
          text: "3 days ago",
          observedAt: new Date(now + 86400000).toISOString(),
        },
      },
      now,
    ),
    false,
  );
  assert.equal(
    hasRecentPublication(proof("3 days ago"), now + 50 * 86400000),
    false,
  );
});
test("relative publication is public with truthful evidence, indexed, filtered and never relabelled as verified or as apprenticeship", async () => {
  const folder = await mkdtemp("/tmp/relative-offer-");
  let store = new OfferStore(folder);
  try {
    let inbox = new SerpApiInbox(store);
    const result = await inbox.ingestAutomatically([job()], geo);
    assert.equal(result.published, 1);
    const offer = (await store.query()).offers[0];
    assert.equal(offer.publishedAt, null);
    assert.equal(offer.sourcePublishedAt, null);
    assert.equal(offer.lastVerifiedAt, null);
    assert.equal(offer.contract, "Alternance — type non précisé");
    assert.equal(offer.publicationEvidence.text, "il y a 3 jours");
    assert.equal((await store.query({ age: "7" })).total, 1);
    assert.equal((await store.query({ age: "1" })).total, 0);
    assert.equal((await store.query({ contract: "Apprentissage" })).total, 0);
    assert.equal(
      selectOffers([offer], { ...defaultFilters, age: "7" }).length,
      1,
    );
    assert.equal(
      selectOffers([offer], defaultFilters, now + 50 * 86400000).length,
      0,
    );
    const originalEvidence = offer.publicationEvidence;
    await inbox.ingestAutomatically([job()], geo);
    assert.deepEqual(
      (await store.read())[0].publicationEvidence,
      originalEvidence,
    );
    store.close();
    store = new OfferStore(folder);
    inbox = new SerpApiInbox(store);
    assert.equal((await store.query()).total, 1);
    assert.equal(store.lastComplianceAudit.withdrawn, 0);
    const stale = await inbox.ingestAutomatically(
      [{ ...job(), extensions: ["il y a 90 jours"] }],
      geo,
    );
    assert.equal(stale.published, 0);
    assert.equal((await store.query()).total, 0);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("previously saved Google Jobs results are reanalyzed at their actual observation time, without a new SerpApi call", async () => {
  const folder = await mkdtemp("/tmp/relative-reanalysis-");
  const store = new OfferStore(folder);
  try {
    const inbox = new SerpApiInbox(store);
    const oldObservedAt = new Date(now - 86400000).toISOString();
    const old = parseSerpCandidate(job(), oldObservedAt);
    delete old.publicationEvidence;
    store.db
      .prepare(
        "INSERT INTO serpapi_candidates(id,retrieved_at,payload) VALUES(?,?,?)",
      )
      .run(old.id, oldObservedAt, JSON.stringify(old));
    const report = await inbox.reanalyzeSaved(geo);
    assert.equal(report.published, 1);
    const offer = (await store.query()).offers[0];
    assert.equal(offer.publicationEvidence.observedAt, oldObservedAt);
    assert.equal(offer.firstRetrievedAt, oldObservedAt);
    assert.equal(offer.lastFetchedAt, oldObservedAt);
    assert.equal(
      publicationIndex(offer),
      relativePublicationWindow("il y a 3 jours", oldObservedAt).earliest,
    );
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("contract metadata is respected and exclusions identify the actual missing field", () => {
  const parsed = parseSerpCandidate({
    ...job(),
    title: "Technicien robotique — exemple fictif",
    extensions: ["Internship", "3 days ago"],
  });
  assert.ok(parsed);
  assert.equal(
    serpExclusionReason({ ...job(), description: "" }),
    "source_description_missing",
  );
  assert.equal(
    serpExclusionReason({ ...job(), company_name: "" }),
    "source_employer_missing",
  );
  assert.equal(serpExclusionReason({ ...job(), via: "Meteojob" }), "meteojob");
  assert.equal(
    serpExclusionReason({ ...job(), title: "CDI automaticien" }),
    "ineligible_contract",
  );
});
