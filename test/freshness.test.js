import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { isRecentPublication, publicationCutoff } from "../shared/freshness.js";
import { publicOffer } from "../server/domain.js";
import { OfferStore } from "../server/store.js";
import { selectOffers, defaultFilters } from "../src/domain.js";
const day = 86400000;
const offer = (date) => ({
  id: "freshness-" + date,
  title: "Exemple fictif — test de limite " + date,
  company: {
    id: "freshness-company",
    name: "Entreprise fictive de test",
    website: "https://example.org",
  },
  location: { label: "Paris", region: "Île-de-France" },
  domain: "Chimie, procédés & matériaux",
  contract: "Stage",
  education: ["Bac + 3"],
  technologies: [],
  publicContacts: [],
  description: "Exemple fictif utilisé uniquement dans les tests.",
  publishedAt: date,
  sourcePublishedAt: date,
  sourceUrl: "https://example.org/" + date,
  expiresAt: new Date(Date.now() + 10 * day).toISOString().slice(0, 10),
  moderationStatus: "approved",
  status: "to_verify",
  lastVerifiedAt: null,
});
test("45 jours inclus : publication originale, date absente/future et favori ancien", () => {
  const now = Date.parse("2026-10-27T20:00:00Z");
  assert.equal(publicationCutoff(now), "2026-09-12");
  for (const value of ["2026-09-12", "2026-10-27"])
    assert.equal(isRecentPublication(value, now), true);
  for (const value of [
    "2026-09-11",
    "2026-10-28",
    "2026-09-31",
    null,
    "invalide",
  ])
    assert.equal(isRecentPublication(value, now), false);
  const old = {
    ...offer("2026-09-11"),
    lastFetchedAt: "2026-10-27",
    sourceUpdatedAt: "2026-10-27",
  };
  assert.equal(publicOffer(old, now), null);
  assert.equal(
    selectOffers([old, offer("2026-09-12")], defaultFilters, now).length,
    1,
  );
});
test("SQLite retire les annonces trop anciennes des listes, compteurs, entreprises et détails", async () => {
  const folder = await mkdtemp("/tmp/offres-age-test-");
  const store = new OfferStore(folder);
  try {
    const boundary = publicationCutoff(),
      stale = new Date(Date.parse(boundary) - day).toISOString().slice(0, 10);
    for (const date of [boundary, stale]) await store.submit(offer(date));
    const result = await store.query();
    assert.equal(result.total, 1);
    assert.equal(result.offers[0].publishedAt, boundary);
    assert.equal(
      (await store.query({ companyId: "freshness-company" })).total,
      1,
    );
    assert.equal(await store.getPublic("freshness-" + stale), null);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
