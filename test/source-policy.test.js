import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { isBlockedSource } from "../shared/source-policy.js";
import { normalizeSubmission, publicOffer } from "../server/domain.js";
import { OfferStore } from "../server/store.js";
import { normalizeRecord } from "../server/ingestion/pipeline.js";
import {
  SerpApiInbox,
  parseSerpCandidate,
} from "../server/ingestion/serpapi-inbox.js";
import { importSerpApiOnce } from "../server/ingestion/serpapi-startup.js";
import { parseFranceTravail } from "../server/ingestion/france-travail.js";
import { createSerpApiProbe } from "../server/ingestion/serpapi.js";
import { selectOffers, defaultFilters } from "../src/domain.js";
const input = () => ({
  title: "Stage — exemple fictif Linux",
  companyName: "Entreprise fictive",
  companyWebsite: "https://example.org",
  city: "Paris",
  region: "Île-de-France",
  domain: "Systèmes, réseaux & cloud",
  contract: "Stage",
  description: "Exemple fictif, Docker et Linux.",
  sourceUrl: "https://example.org/job/test",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  consent: true,
});
const job = () => ({
  title: input().title,
  company_name: input().companyName,
  source_link: input().sourceUrl,
  description: input().description,
  location: "Paris, France",
});
test("Meteojob is excluded by provider, original/candidature links or any Google Jobs application option, without matching descriptions or lookalike domains", () => {
  for (const fields of [
    { via: "via Météojob" },
    { sourcePartner: "Meteojob" },
    {
      sourceUrl:
        "https://tracking.example.org/redirect?url=https%3A%2F%2Fmeteojob.com%2Fjob",
    },
    { sourceName: "La Bonne Alternance / Meteojob" },
    { sourceUrl: "https://jobs.meteojob.com/a" },
    { applicationUrl: "https://www.METEOJOB.COM/a" },
    { apply_options: [{ title: "Meteojob", link: "https://example.org/job" }] },
  ])
    assert.equal(isBlockedSource(fields), true);
  for (const fields of [
    { description: "Ancienne annonce Meteojob" },
    { sourceUrl: "https://meteojob.com.example.org/job" },
    { sourceUrl: "https://example.org/?q=meteojob" },
  ])
    assert.equal(isBlockedSource(fields), false);
  assert.throws(() =>
    normalizeSubmission({
      ...input(),
      applicationUrl: "https://meteojob.com/job",
    }),
  );
  assert.throws(() =>
    normalizeRecord(
      { ...input(), sourcePartner: "Meteojob" },
      { id: "fiction", kind: "json" },
    ),
  );
  const old = {
    ...normalizeSubmission(input()),
    moderationStatus: "approved",
    sourcePartner: "Meteojob",
  };
  assert.equal(publicOffer(old), null);
  assert.equal(selectOffers([old], defaultFilters).length, 0);
  assert.equal(parseSerpCandidate({ ...job(), via: "Meteojob" }), null);
  assert.equal(
    parseSerpCandidate({
      ...job(),
      apply_options: [{ link: "https://meteojob.com/job" }],
    }),
    null,
  );
});
test("legacy approved, pending and expired Meteojob rows are withdrawn durably; incoming imports are blocked", async () => {
  const folder = await mkdtemp("/tmp/blocked-source-");
  let store = new OfferStore(folder);
  try {
    for (const [i, moderation] of [
      "approved",
      "pending",
      "approved",
    ].entries()) {
      const offer = {
        ...normalizeSubmission({
          ...input(),
          title: `Stage — exemple fictif Linux ${i}`,
          sourceUrl: `https://example.org/job/${i}`,
        }),
        id: randomUUID(),
        moderationStatus: moderation,
        sourcePartner: "Meteojob",
        status: i === 2 ? "expired" : "to_verify",
      };
      store.writeOffer(offer); // Simulate historical rows predating the exclusion.
    }
    store.close();
    store = new OfferStore(folder);
    assert.equal(store.lastComplianceAudit.withdrawn, 3);
    assert.equal((await store.query()).total, 0);
    assert.ok(
      (await store.read()).every((o) => o.moderationStatus === "withdrawn"),
    );
    assert.equal(store.auditPublicOffers().withdrawn, 0);
    const blocked = {
      ...normalizeSubmission(input()),
      sourcePartner: "Meteojob",
    };
    assert.equal(await store.ingest(blocked), "invalid");
    await assert.rejects(store.submit(blocked));
    const inbox = new SerpApiInbox(store);
    const candidate = { ...parseSerpCandidate(job()), via: "Meteojob" };
    store.db
      .prepare(
        "INSERT INTO serpapi_candidates(id,retrieved_at,payload) VALUES(?,?,?)",
      )
      .run(candidate.id, candidate.firstRetrievedAt, JSON.stringify(candidate));
    assert.equal(inbox.excludeBlocked(), 1);
    assert.equal(inbox.list().length, 0);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("requested startup import runs once across concurrent callers and redeploys, analyzes results and never fabricates missing dates or publishes", async () => {
  const folder = await mkdtemp("/tmp/serp-once-");
  let store = new OfferStore(folder);
  let calls = 0;
  const probe = createSerpApiProbe({
    env: { SERPAPI_API_KEY: "fake-only" },
    fetcher: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          jobs_results: [job(), { ...job(), via: "Meteojob" }],
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  });
  try {
    const args = { store, probe, inbox: new SerpApiInbox(store) };
    const results = await Promise.all([
      importSerpApiOnce(args),
      importSerpApiOnce(args),
    ]);
    assert.ok(results.some((r) => r.status === "success"));
    assert.ok(results.some((r) => r.status === "already_attempted"));
    assert.equal(calls, 1);
    const candidate = args.inbox.list()[0];
    assert.equal(candidate.publishedAt, null);
    assert.deepEqual(candidate.analysis.technologies, ["Linux", "Docker"]);
    assert.equal((await store.query()).total, 0);
    assert.equal((await store.read()).length, 0);
    assert.equal(store.runs()[0].invalid, 1);
    store.close();
    store = new OfferStore(folder);
    assert.equal(
      (
        await importSerpApiOnce({
          store,
          probe,
          inbox: new SerpApiInbox(store),
        })
      ).status,
      "already_attempted",
    );
    assert.equal(calls, 1);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("missing startup key or disabled startup consumes no quota; failed startup never loops on restart", async () => {
  const folder = await mkdtemp("/tmp/serp-once-failure-");
  const store = new OfferStore(folder);
  let calls = 0;
  try {
    const inbox = new SerpApiInbox(store);
    const unavailable = createSerpApiProbe({
      env: {},
      fetcher: () => assert.fail("network"),
    });
    assert.equal(
      (await importSerpApiOnce({ store, inbox, probe: unavailable })).status,
      "not_configured",
    );
    const probe = createSerpApiProbe({
      env: { SERPAPI_API_KEY: "fake-only" },
      fetcher: async () => {
        calls++;
        return new Response("{}", { status: 429 });
      },
    });
    assert.equal(
      (await importSerpApiOnce({ store, inbox, probe, enabled: false })).status,
      "not_configured",
    );
    assert.equal(
      (await importSerpApiOnce({ store, inbox, probe })).status,
      "error",
    );
    assert.equal(
      (await importSerpApiOnce({ store, inbox, probe })).status,
      "already_attempted",
    );
    assert.equal(calls, 1);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});

test("France Travail partner metadata excludes relayed Meteojob offers before normalization", () => {
  const records = parseFranceTravail({
    resultats: [
      {
        id: "fake-only",
        origineOffre: {
          urlOrigine:
            "https://candidat.francetravail.fr/offres/recherche/detail/fake-only",
          partenaires: [{ nom: "Meteojob", url: "https://example.org/job" }],
        },
      },
    ],
  });
  assert.equal(records.length, 0);
  assert.equal(records.exclusions.incomplete, 1);
});
