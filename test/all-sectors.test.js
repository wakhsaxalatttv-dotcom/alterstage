import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { normalizeSubmission } from "../server/domain.js";
import { seedEditorialCatalogue } from "../server/ingestion/editorial-catalogue.js";
import { Reports } from "../server/reports.js";
import { externalOffers } from "../shared/external-offers.js";
import { domains } from "../shared/catalog.js";
import { SERPAPI_SEARCHES } from "../shared/serpapi-searches.js";
import { franceTravailDomains } from "../server/ingestion/france-travail-domains.js";
import { romeDomains, lbaSource, parseLba } from "../server/ingestion/lba.js";
import { analyzeSerpCandidate } from "../server/ingestion/serpapi-analysis.js";
import {
  createFranceTravailClient,
  FT_TOKEN_URL,
} from "../server/ingestion/france-travail.js";
const fixture = () => ({
  title: "Alternance commercial — exemple fictif",
  companyName: "PME fictive de test",
  companyWebsite: "https://example.org",
  city: "Nantes",
  region: "Pays de la Loire",
  domain: "Commerce & vente",
  contract: "Apprentissage",
  description: "Exemple fictif, jamais en production.",
  sourceUrl: "https://example.org/job/all-sectors",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  consent: true,
});
test("all official ROME families and all site sectors are searched, including SME-specific and unqualified searches", () => {
  assert.equal(Object.keys(franceTravailDomains).length, 1584);
  assert.equal(Object.keys(romeDomains).length, 1584);
  for (const sector of [
    "Commerce & vente",
    "Marketing & communication",
    "Ressources humaines",
    "Santé & médico-social",
    "Hôtellerie, restauration & tourisme",
    "Transport & logistique",
  ])
    assert.ok(domains.includes(sector));
  assert.equal(franceTravailDomains.D1401, "Commerce & vente");
  assert.equal(franceTravailDomains.M1502, "Ressources humaines");
  assert.equal(
    franceTravailDomains.G1602,
    "Hôtellerie, restauration & tourisme",
  );
  assert.ok(SERPAPI_SEARCHES.some((s) => s.query === "stage"));
  assert.ok(SERPAPI_SEARCHES.some((s) => s.query === "alternance PME"));
  assert.ok(new URL(lbaSource.url).href.length < 2000);
  assert.equal(new URL(lbaSource.url).searchParams.has("romes"), false);
  for (const [title, domain] of [
    ["Stage commercial", "Commerce & vente"],
    ["Alternance RH", "Ressources humaines"],
    ["Stage comptabilité", "Comptabilité, finance & audit"],
    ["Stage marketing", "Marketing & communication"],
    ["Apprenti commis de cuisine", "Hôtellerie, restauration & tourisme"],
  ])
    assert.equal(
      analyzeSerpCandidate({
        title,
        description: "Offre de test.",
        publishedAt: new Date().toISOString().slice(0, 10),
      }).domain,
      domain,
    );
});
test("existing sourced employer references populate Offers without claiming a new fetch or verification; withdrawals stay withdrawn after reseeding", async () => {
  const folder = await mkdtemp("/tmp/offres-editorial-bootstrap-");
  let store = new OfferStore(folder);
  try {
    const report = await seedEditorialCatalogue(store);
    assert.ok(report.created > 0);
    const before = (await store.query()).total;
    assert.equal(before, report.created);
    const offer = (await store.query()).offers[0];
    const source = externalOffers.find((r) => r.id === offer.id);
    assert.equal(offer.publishedAt, source.publishedAt);
    assert.equal(offer.lastFetchedAt, source.sourceConsultedAt);
    assert.equal(offer.sourceConsultedAt, source.sourceConsultedAt);
    assert.equal(offer.lastVerifiedAt, null);
    assert.equal(offer.editorialSummary, true);
    assert.equal((await seedEditorialCatalogue(store)).created, 0);
    await store.review(offer.id, { action: "withdraw" });
    await seedEditorialCatalogue(store);
    assert.equal(await store.getPublic(offer.id), null);
    store.close();
    store = new OfferStore(folder);
    await seedEditorialCatalogue(store);
    assert.equal(await store.getPublic(offer.id), null);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("PME alternances and stages from live sources appear in Repérées and Offers, and one report withdraws both views", async () => {
  const folder = await mkdtemp("/tmp/offres-live-reference-");
  const store = new OfferStore(folder);
  try {
    const offer = normalizeSubmission(fixture());
    offer.moderationStatus = "approved";
    await store.submit(offer);
    const reports = new Reports(store);
    const reference = reports.references().find((r) => r.id === offer.id);
    assert.ok(reference);
    assert.equal(reference.contract, "Apprentissage");
    assert.equal(reference.company.name, "PME fictive de test");
    assert.equal(reference.sourceKind, "market");
    const reported = await reports.create({
      offerId: offer.id,
      reason: "closed",
      details: "Exemple fictif de signalement.",
    });
    reports.review(reported.id, {
      action: "withdraw",
      note: "Test uniquement.",
    });
    assert.equal(await store.getPublic(offer.id), null);
    assert.ok(!reports.references().some((r) => r.id === offer.id));
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("a curated reference report also removes its promoted catalogue entry and prevents reseeding", async () => {
  const folder = await mkdtemp("/tmp/offres-curated-report-");
  const store = new OfferStore(folder);
  try {
    await seedEditorialCatalogue(store);
    const offer = (await store.query()).offers[0];
    const reports = new Reports(store);
    const reported = await reports.create({
      offerId: offer.id,
      reason: "closed",
      details: "Exemple fictif de contrôle.",
    });
    reports.review(reported.id, {
      action: "withdraw",
      note: "Test uniquement.",
    });
    assert.equal(await store.getPublic(offer.id), null);
    await seedEditorialCatalogue(store);
    assert.equal(await store.getPublic(offer.id), null);
    assert.ok(!reports.references().some((r) => r.id === offer.id));
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("a bounded France Travail collection resumes at the next official occupation rather than starving later sectors", async () => {
  let cursor = 0;
  const requested = [];
  const options = {
    env: {
      FRANCE_TRAVAIL_CLIENT_ID: "test-only",
      FRANCE_TRAVAIL_CLIENT_SECRET: "test-only",
      FRANCE_TRAVAIL_MAX_REQUESTS: "1",
    },
    readCursor: () => cursor,
    writeCursor: (value) => (cursor = value),
    fetcher: async (url) => {
      if (String(url) === FT_TOKEN_URL)
        return new Response(
          JSON.stringify({ access_token: "fake-only", expires_in: 3600 }),
          { headers: { "content-type": "application/json" } },
        );
      requested.push(new URL(url).searchParams.get("romeCode"));
      return new Response(null, { status: 204 });
    },
  };
  const first = JSON.parse(await createFranceTravailClient(options).collect());
  assert.equal(first.collection.truncated, true);
  assert.equal(cursor, 1);
  await createFranceTravailClient(options).collect();
  assert.equal(cursor, 2);
  assert.notEqual(requested[0], requested[1]);
});
