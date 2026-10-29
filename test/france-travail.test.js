import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import { normalizeSubmission } from "../server/domain.js";
import { parseFeed } from "../server/ingestion/connectors.js";
import {
  normalizeRecord,
  IngestionPipeline,
  readSources,
} from "../server/ingestion/pipeline.js";
import {
  createFranceTravailClient,
  parseFranceTravail,
  franceTravailConfiguration,
  franceTravailSource,
  FT_SEARCH_URL,
  FT_TOKEN_URL,
} from "../server/ingestion/france-travail.js";
const now = Date.now();
const day = (offset) => new Date(now - offset * 864e5).toISOString();
const fixture = (changes = {}) => ({
  id: "fiction-ft-1",
  intitule: "Exemple fictif — apprentissage systèmes",
  description:
    "Exemple fictif de test uniquement. Linux et TCP/IP. Contact : prenom.nom@example.org, 0612345678.",
  dateCreation: day(2),
  dateActualisation: day(1),
  romeCode: "M1801",
  codeNAF: "6202A",
  typeContrat: "CDD",
  typeContratLibelle: "CDD",
  natureContrat: "Contrat apprentissage",
  entreprise: { nom: "Entreprise fictive de test" },
  lieuTravail: {
    commune: "44109",
    codePostal: "44000",
    libelle: "44 - NANTES",
  },
  origineOffre: {
    urlOrigine:
      "https://candidat.francetravail.fr/offres/recherche/detail/fiction-ft-1",
  },
  competences: [{ libelle: "Configurer Linux" }],
  formations: [{ niveauLibelle: "Bac + 2" }],
  ...changes,
});
const credentials = {
  FRANCE_TRAVAIL_CLIENT_ID: "test-only-client",
  FRANCE_TRAVAIL_CLIENT_SECRET: "test-only-secret",
  FRANCE_TRAVAIL_MAX_PAGES: "2",
};
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
test("France Travail requires both private credentials and never contacts OAuth when missing", async () => {
  assert.equal(franceTravailConfiguration({}).configured, false);
  assert.equal(
    franceTravailConfiguration({ FRANCE_TRAVAIL_CLIENT_ID: "one" }).configured,
    false,
  );
  const client = createFranceTravailClient({
    env: {},
    fetcher: () => assert.fail("Network must not run"),
  });
  await assert.rejects(
    client.collect(),
    (error) => error.code === "not_configured",
  );
});
test("France Travail preserves real source dates, contract, origin and missing data; strips all contacts", () => {
  const raw = fixture();
  const parsed = parseFranceTravail({ resultats: [raw] }, now);
  assert.equal(parsed.length, 1);
  const offer = normalizeRecord(parsed[0], franceTravailSource);
  assert.equal(offer.sourcePublishedAt, raw.dateCreation);
  assert.equal(offer.sourceUpdatedAt, raw.dateActualisation);
  assert.equal(offer.sourceUrl, raw.origineOffre.urlOrigine);
  assert.equal(offer.company.website, null);
  assert.equal(offer.contract, "Apprentissage");
  assert.equal(offer.lastVerifiedAt, null);
  assert.equal(offer.sourceExpiresAt, null);
  assert.equal(offer.sourcePolicyApproved, true);
  assert.deepEqual(offer.publicContacts, []);
  assert.ok(!offer.description.includes("prenom.nom@"));
  assert.ok(!offer.description.includes("0612345678"));
  assert.deepEqual(offer.education, ["Bac + 2"]);
  assert.equal(offer.location.region, "Pays de la Loire");
});
test("France Travail excludes >45 days, future dates, anonymous employers, schools, ordinary CDD and off-topic roles", () => {
  const jobs = [
    fixture(),
    fixture({ id: "old", dateCreation: day(46) }),
    fixture({ id: "future", dateCreation: day(-1) }),
    fixture({ id: "anonymous", entreprise: {} }),
    fixture({ id: "school", codeNAF: "8559A" }),
    fixture({ id: "cdd", natureContrat: "Contrat travail" }),
    fixture({ id: "sales", romeCode: "D1401" }),
  ];
  const records = parseFranceTravail({ resultats: jobs }, now);
  assert.equal(records.length, 1);
  assert.deepEqual(records.exclusions, {
    old: 2,
    school: 1,
    contract: 1,
    outOfScope: 1,
    incomplete: 1,
  });
  assert.equal(
    parseFranceTravail({ resultats: [fixture({ dateCreation: day(40) })] }, now)
      .length,
    1,
  );
  assert.equal(
    parseFranceTravail(
      {
        resultats: [fixture({ natureContrat: "Contrat professionnalisation" })],
      },
      now,
    )[0].contract,
    "Contrat de professionnalisation",
  );
  assert.equal(
    parseFranceTravail(
      {
        resultats: [
          fixture({ natureContrat: "", typeContratLibelle: "Stage" }),
        ],
      },
      now,
    )[0].contract,
    "Stage",
  );
});
test("OAuth is server-side, cached in memory, and pagination deduplicates without putting credentials in URLs", async () => {
  let tokens = 0,
    searches = 0;
  const client = createFranceTravailClient({
    env: credentials,
    wait: async () => {},
    fetcher: async (url, options) => {
      assert.equal(options.redirect, "manual");
      assert.ok(
        !String(url).includes(credentials.FRANCE_TRAVAIL_CLIENT_SECRET),
      );
      if (String(url) === FT_TOKEN_URL) {
        tokens++;
        assert.equal(options.method, "POST");
        assert.equal(
          options.body.get("client_secret"),
          credentials.FRANCE_TRAVAIL_CLIENT_SECRET,
        );
        assert.equal(
          options.body.get("scope"),
          `application_${credentials.FRANCE_TRAVAIL_CLIENT_ID} api_offresdemploiv2 o2dsoffre`,
        );
        return json({ access_token: "test-only-access", expires_in: 3600 });
      }
      assert.ok(String(url).startsWith(FT_SEARCH_URL + "?"));
      assert.equal(options.headers.Authorization, "Bearer test-only-access");
      const parsed = new URL(url);
      searches++;
      assert.ok(parsed.searchParams.get("romeCode").split(",").length <= 3);
      return parsed.searchParams.get("range") === "0-149"
        ? json({ resultats: [fixture()] }, 206, {
            "content-range": "offres 0-149/151",
          })
        : json({ resultats: [fixture({ id: "fiction-ft-2" })] }, 200, {
            "content-range": "offres 150-150/151",
          });
    },
  });
  const data = JSON.parse(await client.collect());
  assert.equal(tokens, 1);
  assert.ok(searches > 2);
  assert.equal(data.resultats.length, 2);
  assert.equal(data.collection.truncated, false);
  await client.collect();
  assert.equal(tokens, 1);
});
test("Authentication errors and rate limits produce safe actionable diagnostics, not secret responses", async () => {
  const auth = createFranceTravailClient({
    env: credentials,
    wait: async () => {},
    fetcher: async () =>
      json({ error: credentials.FRANCE_TRAVAIL_CLIENT_SECRET }, 401),
  });
  await assert.rejects(
    auth.collect(),
    (error) =>
      error.code === "authentication" &&
      !error.message.includes(credentials.FRANCE_TRAVAIL_CLIENT_SECRET),
  );
  const denied = createFranceTravailClient({
    env: credentials,
    wait: async () => {},
    fetcher: async (url) =>
      String(url) === FT_TOKEN_URL
        ? json({ access_token: "private", expires_in: 300 })
        : json({ error: "private" }, 403),
  });
  await assert.rejects(
    denied.collect(),
    (error) =>
      error.code === "access_denied" && !error.message.includes("private"),
  );
});
test("Only the fixed FT connector may publish its API records unverified; ingestion is idempotent and withdrawals persist", async () => {
  const directory = await mkdtemp("/tmp/offres-ft-test-");
  const store = new OfferStore(directory);
  try {
    const raw = fixture();
    const pipeline = new IngestionPipeline(store, {
      sources: async () => [franceTravailSource],
      fetcher: async () => JSON.stringify({ resultats: [raw] }),
    });
    assert.equal((await pipeline.run()).reports[0].created, 1);
    assert.equal((await pipeline.run()).reports[0].unchanged, 1);
    const listed = await store.query();
    assert.equal(listed.total, 1);
    assert.equal(listed.offers[0].lastVerifiedAt, null);
    await store.review(listed.offers[0].id, { action: "withdraw" });
    raw.description += " Texte modifié.";
    await pipeline.run();
    assert.equal((await store.query()).total, 0);
    const record = parseFeed(franceTravailSource, {
      resultats: [fixture()],
    })[0];
    assert.throws(() =>
      normalizeRecord(record, {
        ...franceTravailSource,
        url: "https://example.org/feed",
      }),
    );
    assert.throws(() =>
      normalizeSubmission({
        ...record,
        consent: true,
        companyWebsite: "https://example.org",
      }),
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("France Travail refreshes an expired bearer once and honors a bounded quota retry", async () => {
  let tokens = 0,
    searches = 0;
  const delays = [];
  const client = createFranceTravailClient({
    env: credentials,
    wait: async (ms) => delays.push(ms),
    fetcher: async (url) => {
      if (String(url) === FT_TOKEN_URL) {
        tokens++;
        return json({ access_token: `token-${tokens}`, expires_in: 3600 });
      }
      searches++;
      if (searches === 1) return json({}, 401);
      if (searches === 2) return json({}, 429, { "retry-after": "1" });
      return new Response(null, { status: 204 });
    },
  });
  const result = JSON.parse(await client.collect());
  assert.equal(tokens, 2);
  assert.deepEqual(result.resultats, []);
  assert.ok(delays.includes(1000));
  const blocked = createFranceTravailClient({
    env: credentials,
    wait: async () => {},
    fetcher: async (url) =>
      String(url) === FT_TOKEN_URL
        ? json({ access_token: "test", expires_in: 3600 })
        : json({}, 429),
  });
  await assert.rejects(
    blocked.collect(),
    (error) => error.code === "rate_limited",
  );
});
test("France Travail reports page caps and does not infer an exhaustive market count", async () => {
  const client = createFranceTravailClient({
    env: {
      ...credentials,
      FRANCE_TRAVAIL_MAX_PAGES: "1",
      FRANCE_TRAVAIL_MAX_REQUESTS: "1",
    },
    wait: async () => {},
    fetcher: async (url) =>
      String(url) === FT_TOKEN_URL
        ? json({ access_token: "test", expires_in: 3600 })
        : json({ resultats: [fixture()] }, 206, {
            "content-range": "offres 0-149/999",
          }),
  });
  const data = JSON.parse(await client.collect());
  assert.equal(data.collection.truncated, true);
  assert.equal(data.resultats.length, 1);
  assert.ok(
    normalizeRecord(
      parseFranceTravail(
        { resultats: [fixture({ dateCreation: day(40) })] },
        now,
      )[0],
      franceTravailSource,
    ).sourcePolicyApproved,
  );
});
test("France Travail source is automatically merged with custom feeds and can be disabled without exposing credentials", async () => {
  const keys = [
    "FRANCE_TRAVAIL_CLIENT_ID",
    "FRANCE_TRAVAIL_CLIENT_SECRET",
    "FRANCE_TRAVAIL_ENABLED",
    "FRANCE_TRAVAIL_MAX_PAGES",
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  const folder = await mkdtemp("/tmp/ft-sources-test-");
  try {
    const { writeFile } = await import("node:fs/promises");
    const file = folder + "/sources.json";
    await writeFile(file, "[]");
    Object.assign(process.env, credentials, { FRANCE_TRAVAIL_ENABLED: "true" });
    const sources = await readSources(file);
    assert.deepEqual(sources, [franceTravailSource]);
    assert.ok(
      !JSON.stringify(sources).includes(
        credentials.FRANCE_TRAVAIL_CLIENT_SECRET,
      ),
    );
    process.env.FRANCE_TRAVAIL_ENABLED = "false";
    assert.deepEqual(await readSources(file), []);
  } finally {
    for (const key of keys)
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    await rm(folder, { recursive: true, force: true });
  }
});
test("Broad technical discovery has no keyword gate and splits saturated periods without losing boundary records", async () => {
  const leaves = new Set(),
    queried = new Set();
  const client = createFranceTravailClient({
    env: credentials,
    now: () => now,
    wait: async () => {},
    fetcher: async (url) => {
      if (String(url) === FT_TOKEN_URL)
        return json({ access_token: "test", expires_in: 3600 });
      const query = new URL(url).searchParams;
      assert.equal(query.has("motsCles"), false);
      const rome = query.get("romeCode");
      queried.add(rome);
      assert.ok(query.has("minCreationDate") && query.has("maxCreationDate"));
      if (rome !== "H1503") return new Response(null, { status: 204 });
      const min = Date.parse(query.get("minCreationDate")),
        max = Date.parse(query.get("maxCreationDate"));
      const id = `fiction-${min}-${max}`;
      const job = fixture({
        id,
        romeCode: rome,
        intitule: "Exemple fictif — technicien de laboratoire",
        dateCreation: new Date(
          Math.floor((min + max) / 2000) * 1000,
        ).toISOString(),
      });
      if (max - min > 20 * 864e5)
        return json({ resultats: [job] }, 206, {
          "content-range": "offres 0-149/999",
        });
      leaves.add(id);
      return json({ resultats: [job] });
    },
  });
  const data = JSON.parse(await client.collect());
  assert.equal(data.collection.truncated, false);
  assert.equal(data.collection.completedRomeCodes, 315);
  assert.equal(queried.size, 315);
  assert.ok(leaves.size >= 4);
  const returned = new Set(data.resultats.map((j) => j.id));
  for (const id of leaves) assert.ok(returned.has(id));
});
test("ROME 4 specializations and previously omitted technical families are eligible", () => {
  const raws = [
    fixture({ romeCode: "I1602" }),
    fixture({ romeCode: "H2903" }),
    fixture({ romeCode: "F1106" }),
    fixture({ romeCode: "H2702" }),
  ];
  const records = parseFranceTravail({ resultats: raws }, now);
  assert.equal(records.length, 4);
  assert.equal(records[0].domain, "Aéronautique, spatial & naval");
  assert.equal(records[1].domain, "Mécanique & productique");
  assert.equal(records[2].domain, "Bâtiment, génie civil & travaux publics");
  assert.equal(records[3].domain, "Énergie & environnement");
});
test("Incomplete FT coverage stays partial in the persisted ingestion report while eligible offers publish unverified", async () => {
  const directory = await mkdtemp("/tmp/ft-partial-");
  const store = new OfferStore(directory);
  try {
    const coverage = {
      truncated: true,
      completedRomeCodes: 1,
      totalRomeCodes: 315,
      limitations: ["request_budget"],
    };
    const pipeline = new IngestionPipeline(store, {
      sources: async () => [franceTravailSource],
      fetcher: async () =>
        JSON.stringify({ resultats: [fixture()], collection: coverage }),
    });
    const result = await pipeline.run();
    assert.equal(result.reports[0].status, "partial");
    assert.equal(result.reports[0].created, 1);
    assert.deepEqual(store.runs()[0].coverage, coverage);
    assert.equal((await store.query()).offers[0].lastVerifiedAt, null);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("OAuth diagnostics distinguish known causes and never echo response descriptions or secrets", async () => {
  for (const [error, expected] of [
    ["invalid_client", "même application"],
    ["invalid_scope", "Droits OAuth"],
    ["unauthorized_client", "Application non autorisée"],
    ["unexpected-server-text", "Authentification refusée"],
  ]) {
    const client = createFranceTravailClient({
      env: credentials,
      wait: async () => {},
      fetcher: async () =>
        json(
          {
            error,
            error_description: credentials.FRANCE_TRAVAIL_CLIENT_SECRET,
            access_token: "must-not-leak",
          },
          400,
        ),
    });
    await assert.rejects(client.collect(), (failure) => {
      assert.ok(failure.message.includes("OAuth HTTP 400"));
      assert.ok(failure.message.includes(expected));
      assert.ok(
        !failure.message.includes(credentials.FRANCE_TRAVAIL_CLIENT_SECRET),
      );
      assert.ok(!failure.message.includes("must-not-leak"));
      if (error === "unexpected-server-text")
        assert.ok(!failure.message.includes(error));
      return true;
    });
  }
  const unavailable = createFranceTravailClient({
    env: credentials,
    wait: async () => {},
    fetcher: async () =>
      new Response("private upstream details", { status: 503 }),
  });
  await assert.rejects(
    unavailable.collect(),
    (error) =>
      error.code === "network" &&
      error.message.includes("HTTP 503") &&
      !error.message.includes("private upstream"),
  );
});
test("OAuth application scope uses the exact trimmed client_id and never the secret", async () => {
  const env = {
    ...credentials,
    FRANCE_TRAVAIL_CLIENT_ID: "  test-only-client\n",
  };
  let tested = false;
  const client = createFranceTravailClient({
    env,
    wait: async () => {},
    fetcher: async (url, options) => {
      if (String(url) !== FT_TOKEN_URL)
        return new Response(null, { status: 204 });
      tested = true;
      assert.equal(options.body.get("client_id"), "test-only-client");
      assert.deepEqual(options.body.get("scope").split(" "), [
        "application_test-only-client",
        "api_offresdemploiv2",
        "o2dsoffre",
      ]);
      assert.ok(
        !options.body.get("scope").includes(env.FRANCE_TRAVAIL_CLIENT_SECRET),
      );
      return json({ access_token: "test-only-token", expires_in: 3600 });
    },
  });
  await client.collect();
  assert.equal(tested, true);
});
