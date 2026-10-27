import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { normalizeSubmission } from "../server/domain.js";
const fixture = (n = 0, fields = {}) =>
  normalizeSubmission({
    title: `Exemple fictif — démonstration ${n}`,
    companyName: "Entreprise fictive SQL",
    companyWebsite: "https://example.org/",
    sourceUrl: `https://example.org/jobs/${n}`,
    contract: "Stage",
    city: n % 2 ? "Nantes" : "Lyon",
    region: n % 2 ? "Pays de la Loire" : "Auvergne-Rhône-Alpes",
    domain: "Systèmes, réseaux & cloud",
    description:
      n % 2
        ? "Poste fictif Linux et Docker."
        : "Poste fictif Windows et Cisco.",
    publishedAt: new Date().toISOString().slice(0, 10),
    expiresAt: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
    consent: true,
    ...fields,
  });
const attest = {
  action: "approve",
  sourceChecked: true,
  rightsChecked: true,
  companyChecked: true,
  contactChecked: true,
};
async function withStore(run) {
  const folder = await mkdtemp("/tmp/offres-sql-");
  const store = new OfferStore(folder);
  try {
    await run(store, folder);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
}
test("indexed multi-criteria search paginates, counts all results, and rejects SQL/FTS injection", () =>
  withStore(async (store) => {
    for (let n = 0; n < 25; n++) {
      const o = fixture(n);
      await store.submit(o);
      await store.review(o.id, attest);
    }
    let page = await store.query({
      city: "nantes",
      tech: "Docker",
      contract: "Stage",
      query: "fictif Linux",
      pageSize: 5,
    });
    assert.equal(page.total, 12);
    assert.equal(page.offers.length, 5);
    assert.equal(page.pages, 3);
    assert.equal(page.facets.technologies.includes("Cisco"), true);
    page = await store.query({
      city: "nantes",
      tech: "Docker",
      page: 3,
      pageSize: 5,
    });
    assert.equal(page.offers.length, 2);
    assert.equal((await store.query({ city: "' OR 1=1 --" })).total, 0);
    assert.equal((await store.query({ query: '" ) OR * --' })).total, 0);
    const plan = store.db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT id FROM offers WHERE moderation='approved' AND city_key='nantes' ORDER BY published_at DESC",
      )
      .all();
    assert.ok(plan.some((row) => row.detail.includes("offer_city")));
    assert.equal(
      (await store.query({ region: "Bretagne", tech: "Docker" })).total,
      0,
    );
  }));
test("cache is invalidated by moderation and by commits on another connection", () =>
  withStore(async (store, folder) => {
    const offer = fixture();
    await store.submit(offer);
    assert.equal((await store.query()).total, 0);
    await store.review(offer.id, attest);
    assert.equal((await store.query()).total, 1);
    const second = new OfferStore(folder);
    try {
      await second.review(offer.id, { action: "withdraw" });
      assert.equal((await store.query()).total, 0);
    } finally {
      second.close();
    }
  }));
test("legacy JSON migrates once, preserving IDs, dates, status and the untouched backup", async () => {
  const folder = await mkdtemp("/tmp/offres-migrate-");
  const original = JSON.stringify([
    { ...fixture(), firstRetrievedAt: "2026-01-01T10:00:00Z" },
  ]);
  await writeFile(folder + "/offers.json", original);
  let store;
  try {
    store = new OfferStore(folder);
    const rows = await store.read();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firstRetrievedAt, "2026-01-01T10:00:00Z");
    store.close();
    store = new OfferStore(folder);
    assert.equal((await store.read()).length, 1);
    assert.equal(await readFile(folder + "/offers.json", "utf8"), original);
  } finally {
    store?.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("company enrichment is published only after review, with provenance", () =>
  withStore(async (store) => {
    const offer = fixture(0, {
      companyType: "PME",
      companySize: "10–49 salariés",
      companyLocations: "Nantes, Lyon",
      companyStack: "Linux, Python",
      companyRhythm: "3 semaines / 1 semaine",
      companyTags: ["Réseaux & Télécoms"],
      profileSourceUrl: "https://example.org/company",
    });
    await store.submit(offer);
    assert.equal(await store.company("example.org"), null);
    await store.review(offer.id, attest);
    const profile = await store.company("example.org");
    assert.deepEqual(profile.stack, ["Linux", "Python"]);
    assert.equal(profile.rhythm, "3 semaines / 1 semaine");
    assert.equal(profile.profileSourceUrl, "https://example.org/company");
    assert.ok(profile.profileVerifiedAt);
  }));
