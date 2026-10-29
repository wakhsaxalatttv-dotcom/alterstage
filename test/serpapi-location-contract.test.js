import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createFrenchLocationResolver } from "../server/ingestion/french-location.js";
import { SerpApiInbox } from "../server/ingestion/serpapi-inbox.js";
import { SerpApiAutomation } from "../server/ingestion/serpapi-automation.js";
import { OfferStore } from "../server/store.js";
import { analyzeSerpCandidate } from "../server/ingestion/serpapi-analysis.js";
const json = (value) =>
  new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
const commune = {
  nom: "Nantes",
  code: "44109",
  codeRegion: "52",
  codesPostaux: ["44000", "44100", "44200", "44300"],
};
test("French source regions, postcodes and FR are validated against the exact official commune instead of requiring the word France", async () => {
  const resolver = createFrenchLocationResolver({
    fetcher: async () => json([commune]),
  });
  for (const source of [
    "Nantes, Pays de la Loire",
    "44000 Nantes",
    "Nantes, FR",
  ])
    assert.equal((await resolver(source)).region, "Pays de la Loire", source);
  assert.equal(await resolver("Nantes, Bretagne"), null);
  assert.equal(await resolver("Nantes, 75001"), null);
  assert.equal(await resolver("Nantes"), null);
  assert.equal(
    (await resolver("Nantes", { countryContext: "FR" })).countryBasis,
    "france-search-and-unique-official-commune",
  );
  assert.equal(await resolver("Paris, Texas", { countryContext: "FR" }), null);
});
test("French region disambiguates namesakes and punctuation variants, while ambiguous bare city names stay unpublished", async () => {
  const resolver = createFrenchLocationResolver({
    fetcher: async () =>
      json([
        {
          nom: "Saint-Denis",
          code: "93066",
          codeRegion: "11",
          codesPostaux: ["93200"],
        },
        {
          nom: "Saint-Denis",
          code: "97411",
          codeRegion: "04",
          codesPostaux: ["97400"],
        },
      ]),
  });
  assert.equal(await resolver("Saint Denis", { countryContext: "FR" }), null);
  assert.equal((await resolver("Saint Denis, Ile de France")).commune, "93066");
  assert.equal((await resolver("97400 Saint-Denis")).commune, "97411");
});
test("geography failures report a safe actionable reason without response bodies or exception secrets", async () => {
  const denied = createFrenchLocationResolver({
    fetcher: async () =>
      new Response("private-network-details", { status: 403 }),
  });
  assert.deepEqual(await denied.inspect("Nantes, France"), {
    location: null,
    reason: "geocoding_http_403",
  });
  const unavailable = createFrenchLocationResolver({
    fetcher: async () => {
      throw new Error("private-key-not-to-display");
    },
  });
  assert.deepEqual(await unavailable.inspect("Nantes, France"), {
    location: null,
    reason: "geocoding_unavailable",
  });
});
test("technical titles lacking contract words are analyzed using explicit source propositions, without treating past experience or a refusal as an offer", () => {
  const base = {
    title: "Technicien automaticien F/H",
    publishedAt: new Date().toISOString().slice(0, 10),
  };
  for (const description of [
    "Ce poste est proposé en alternance.",
    "Type de contrat : alternance.",
    "Nous recrutons un alternant pour cette mission.",
  ])
    assert.deepEqual(analyzeSerpCandidate({ ...base, description }).contracts, [
      "Alternance — type non précisé",
    ]);
  assert.deepEqual(
    analyzeSerpCandidate({
      ...base,
      description: "Nous recherchons un stagiaire pour cette mission.",
    }).contracts,
    ["Stage"],
  );
  for (const description of [
    "Une première expérience en stage est appréciée.",
    "Ce poste n’est pas proposé en alternance.",
  ])
    assert.deepEqual(
      analyzeSerpCandidate({ ...base, description }).contracts,
      [],
    );
});
test("real geocoding path and source description publish a recent technical offer without the word France or alternance in its title", async () => {
  const folder = await mkdtemp("/tmp/source-location-contract-");
  const store = new OfferStore(folder);
  try {
    const inbox = new SerpApiInbox(store);
    const resolve = createFrenchLocationResolver({
      fetcher: async () => json([commune]),
    });
    const report = await inbox.ingestAutomatically(
      [
        {
          title: "Technicien automaticien — exemple fictif",
          company_name: "Entreprise fictive",
          description:
            "Ce poste est proposé en alternance. Robotique et automatismes.",
          location: "Nantes, Pays de la Loire",
          source_link: "https://example.org/jobs/source-location",
          extensions: ["3 days ago", "Full-time"],
        },
      ],
      resolve,
    );
    assert.equal(report.published, 1);
    const offer = (await store.query()).offers[0];
    assert.equal(offer.location.region, "Pays de la Loire");
    assert.equal(offer.contract, "Alternance — type non précisé");
    assert.equal(offer.publishedAt, null);
    assert.equal(offer.lastVerifiedAt, null);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("initial searches can run one minute apart without increasing three-per-hour or daily quotas", async () => {
  const folder = await mkdtemp("/tmp/source-search-burst-");
  const store = new OfferStore(folder);
  let time = Date.now(),
    calls = 0;
  try {
    const inbox = new SerpApiInbox(store),
      probe = {
        configured: () => true,
        run: async ({ onResults }) => {
          calls++;
          return { status: "success", imported: await onResults([]) };
        },
      };
    const auto = new SerpApiAutomation({
      store,
      inbox,
      probe,
      resolveLocation: async () => null,
      now: () => time,
      env: {},
    });
    for (let i = 0; i < 3; i++) {
      assert.equal((await auto.tick()).status, "success");
      time += 60000;
    }
    assert.equal((await auto.tick()).status, "waiting");
    assert.equal(calls, 3);
    time += 3600000;
    assert.equal((await auto.tick()).status, "success");
    assert.equal(calls, 4);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("corrective retry revisits the last zero-publication query once and preserves the prior quota usage", async () => {
  const { SERPAPI_SEARCHES } = await import("../shared/serpapi-searches.js");
  const folder = await mkdtemp("/tmp/source-corrective-retry-");
  const store = new OfferStore(folder);
  let time = Date.parse(new Date().toISOString().slice(0, 10)) + 12 * 3600000;
  const queries = [];
  try {
    const inbox = new SerpApiInbox(store),
      probe = {
        configured: () => true,
        run: async ({ query, onResults }) => {
          queries.push(query);
          return { status: "success", imported: await onResults([]) };
        },
      };
    const auto = new SerpApiAutomation({
      store,
      inbox,
      probe,
      resolveLocation: async () => null,
      now: () => time,
      env: {},
    });
    const previous = SERPAPI_SEARCHES[5];
    store.db
      .prepare("INSERT INTO metadata(key,value) VALUES('serpapi-auto-state',?)")
      .run(
        JSON.stringify({
          status: "success",
          query: previous.query,
          published: 0,
        }),
      );
    store.db
      .prepare(
        "UPDATE serpapi_schedule SET last_attempt=?,last_success=? WHERE id=?",
      )
      .run(time - 120000, time - 120000, previous.id);
    store.db
      .prepare(
        "INSERT INTO serpapi_auto_requests(started_at,query_id,status) VALUES(?,?,'success')",
      )
      .run(time - 120000, previous.id);
    assert.equal((await auto.tick()).status, "success");
    assert.equal(queries[0], previous.query);
    assert.equal(auto.status().usedToday, 2);
    time += 60000;
    assert.equal((await auto.tick()).status, "success");
    assert.notEqual(queries[1], previous.query);
    assert.equal(auto.status().usedToday, 3);
    time += 60000;
    assert.equal((await auto.tick()).status, "waiting");
    assert.equal(queries.length, 2);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
