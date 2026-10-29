import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { SerpApiInbox } from "../server/ingestion/serpapi-inbox.js";
import { SerpApiAutomation } from "../server/ingestion/serpapi-automation.js";
import { analyzeSerpCandidate } from "../server/ingestion/serpapi-analysis.js";
import { createFrenchLocationResolver } from "../server/ingestion/french-location.js";
import { SERPAPI_SEARCHES } from "../shared/serpapi-searches.js";
import { domains } from "../shared/catalog.js";
const now = Date.now();
const job = () => ({
  title: "Stage développeur logiciel — exemple fictif",
  company_name: "Entreprise fictive",
  location: "Paris, France",
  source_link: "https://example.org/jobs/automated",
  description:
    "<p>Développement logiciel, Linux et Docker.</p>prenom.nom@example.org",
  detected_extensions: { posted_at: new Date(now).toISOString().slice(0, 10) },
});
const location = {
  city: "Paris",
  label: "Paris, France",
  region: "Île-de-France",
  commune: "75056",
  provenance: "https://geo.api.gouv.fr/decoupage-administratif/communes",
};
async function setup() {
  const folder = await mkdtemp("/tmp/serp-automatic-");
  const store = new OfferStore(folder);
  return {
    folder,
    store,
    inbox: new SerpApiInbox(store),
    close: async () => {
      store.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}
test("automatic discovery covers every site domain for both stages and alternances", () => {
  assert.equal(SERPAPI_SEARCHES.length, domains.length * 2);
  for (const domain of domains)
    assert.deepEqual(
      SERPAPI_SEARCHES.filter((s) => s.domain === domain).map(
        (s) => s.contract,
      ),
      ["stage", "alternance"],
    );
  assert.equal(
    new Set(SERPAPI_SEARCHES.map((s) => s.id)).size,
    SERPAPI_SEARCHES.length,
  );
});
test("automatic analysis does not infer publication dates, alternance subtypes or technical roles from the search query", () => {
  const candidate = {
    title: "Alternance informatique",
    description: "Une alternance.",
    publishedAt: null,
  };
  const r = analyzeSerpCandidate(candidate);
  assert.ok(r.reasons.includes("publication_missing_or_outside_45_days"));
  assert.deepEqual(r.contracts, ["Alternance — type non précisé"]);
  assert.equal(
    analyzeSerpCandidate({
      ...candidate,
      title: "Stage marketing cloud",
    }).reasons.includes("non_technical_role"),
    true,
  );
  assert.equal(
    analyzeSerpCandidate({ ...candidate, title: "Stage chimie matériaux" })
      .domain,
    "Chimie, procédés & matériaux",
  );
});
test("automatic import publishes only eligible sourced offers, keeps missing information unknown and respects withdrawals and Meteojob exclusions", async () => {
  const s = await setup();
  let geoCalls = 0;
  const geo = async () => {
    geoCalls++;
    return location;
  };
  try {
    const report = await s.inbox.ingestAutomatically(
      [
        job(),
        {
          ...job(),
          source_link: "https://example.org/no-date",
          detected_extensions: undefined,
        },
        { ...job(), via: "Meteojob" },
      ],
      geo,
    );
    assert.equal(report.created, 1);
    assert.equal(report.published, 1);
    assert.equal(report.deferred, 1);
    assert.equal(report.excluded, 1);
    assert.equal(geoCalls, 1);
    const offer = (await s.store.query()).offers[0];
    assert.equal(offer.company.website, null);
    assert.equal(offer.lastVerifiedAt, null);
    assert.equal(offer.technicalReviewAt, null);
    assert.deepEqual(offer.publicContacts, []);
    assert.ok(!offer.description.includes("prenom.nom@example.org"));
    assert.equal(offer.sourceName, "Google Jobs via SerpApi");
    assert.equal(offer.location.commune, "75056");
    assert.equal(
      (await s.inbox.ingestAutomatically([job()], geo)).unchanged,
      1,
    );
    await s.store.review(offer.id, { action: "withdraw" });
    assert.equal(
      (await s.inbox.ingestAutomatically([job()], geo)).published,
      0,
    );
    assert.equal((await s.store.query()).total, 0);
  } finally {
    await s.close();
  }
});
test("absolute date extensions can be used, but relative labels and unknown locations are never converted into invented fields", async () => {
  const s = await setup();
  try {
    const report = await s.inbox.ingestAutomatically(
      [
        {
          ...job(),
          detected_extensions: undefined,
          extensions: [`Publié le ${new Date().toISOString().slice(0, 10)}`],
        },
      ],
      async () => location,
    );
    assert.equal(report.published, 1);
    const relative = await s.inbox.ingestAutomatically(
      [
        {
          ...job(),
          source_link: "https://example.org/relative",
          title: "Stage développeur logiciel — exemple fictif relatif",
          detected_extensions: { posted_at: "3 days ago" },
        },
      ],
      async () => location,
    );
    assert.equal(relative.published, 1);
    const relativeOffer = (await s.store.read()).find((o) =>
      o.sourceUrl.endsWith("/relative"),
    );
    assert.equal(relativeOffer.publishedAt, null);
    assert.equal(relativeOffer.sourcePublishedAt, null);
    assert.equal(relativeOffer.publicationEvidence.text, "3 days ago");
    const unknown = await s.inbox.ingestAutomatically(
      [
        {
          ...job(),
          source_link: "https://example.org/unknown",
          title: "Stage réseau Linux — exemple fictif",
        },
      ],
      async () => null,
    );
    assert.equal(unknown.deferred, 1);
    assert.equal(unknown.reasons.french_location_not_established, 1);
  } finally {
    await s.close();
  }
});
test("French geocoding uses a fixed government API, exact unambiguous matches and cache; country is not inferred from the search", async () => {
  let calls = 0;
  const resolver = createFrenchLocationResolver({
    fetcher: async (url, options) => {
      calls++;
      const u = new URL(url);
      assert.equal(u.origin, "https://geo.api.gouv.fr");
      assert.equal(u.pathname, "/communes");
      assert.equal(u.searchParams.get("nom"), "Paris");
      assert.equal(options.redirect, "error");
      return new Response(
        JSON.stringify([{ nom: "Paris", code: "75056", codeRegion: "11" }]),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  assert.equal(await resolver("Paris, Texas"), null);
  assert.equal(await resolver("Paris"), null);
  assert.equal(calls, 0);
  assert.equal((await resolver("Paris, France")).region, "Île-de-France");
  await resolver("Paris, France");
  assert.equal(calls, 1);
  const ambiguous = createFrenchLocationResolver({
    fetcher: async () =>
      new Response(
        JSON.stringify([
          { nom: "Ville", code: "12345", codeRegion: "11" },
          { nom: "Ville", code: "54321", codeRegion: "84" },
        ]),
        { headers: { "content-type": "application/json" } },
      ),
  });
  assert.equal(await ambiguous("Ville, France"), null);
});
test("scheduler rotates all domains, persists daily/hourly budgets and never reruns successful searches before refresh", async () => {
  const s = await setup();
  let time = Date.parse(new Date().toISOString().slice(0, 10)) + 60000;
  let calls = 0;
  const probe = {
    configured: () => true,
    run: async ({ onResults }) => {
      calls++;
      return { status: "success", imported: await onResults([]) };
    },
  };
  try {
    const auto = new SerpApiAutomation({
      store: s.store,
      inbox: s.inbox,
      probe,
      resolveLocation: async () => null,
      now: () => time,
      env: {},
    });
    for (let i = 0; i < 24; i++) {
      assert.equal((await auto.tick()).status, "success");
      time += 20 * 60000;
    }
    assert.equal((await auto.tick()).status, "waiting");
    assert.equal(calls, 24);
    assert.equal(auto.status().usedToday, 24);
    time += 86400000;
    for (let i = 24; i < SERPAPI_SEARCHES.length; i++) {
      assert.equal((await auto.tick()).status, "success");
      time += 20 * 60000;
    }
    assert.equal(auto.status().completedSearches, 42);
    assert.equal(auto.status().completedDomains, domains.length);
    assert.equal((await auto.tick()).status, "waiting");
    const again = new SerpApiAutomation({
      store: s.store,
      inbox: s.inbox,
      probe,
      resolveLocation: async () => null,
      now: () => time,
      env: {},
    });
    assert.equal((await again.tick()).status, "waiting");
    assert.equal(calls, 42);
  } finally {
    await s.close();
  }
});
test("scheduler prevents concurrent network calls and pauses durably after a quota refusal", async () => {
  const s = await setup();
  let calls = 0;
  const time = Date.now();
  const probe = {
    configured: () => true,
    run: async () => {
      calls++;
      return { status: "error", httpStatus: 429, message: "Quota atteint." };
    },
  };
  try {
    const opts = {
      store: s.store,
      inbox: s.inbox,
      probe,
      resolveLocation: async () => null,
      now: () => time,
      env: {},
    };
    const a = new SerpApiAutomation(opts),
      b = new SerpApiAutomation(opts);
    await Promise.all([a.tick(), b.tick()]);
    assert.equal(calls, 1);
    assert.equal((await b.tick()).status, "waiting");
    assert.equal(b.status().state.pauseUntil, time + 86400000);
    const disabled = new SerpApiAutomation({
      ...opts,
      env: { SERPAPI_AUTO_ENABLED: "false" },
    });
    assert.equal((await disabled.tick()).status, "disabled");
    assert.equal(calls, 1);
  } finally {
    await s.close();
  }
});
