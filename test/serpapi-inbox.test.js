import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { OfferStore } from "../server/store.js";
import {
  SerpApiInbox,
  parseSerpCandidate,
} from "../server/ingestion/serpapi-inbox.js";
import { createApp } from "../server/app.js";
const job = () => ({
  title: "Stage informatique — exemple fictif",
  company_name: "Atelier fictif",
  location: "Nantes, France",
  source_link: "https://example.org/jobs/test",
  description: "<p>Linux et Docker.</p>recruteur@example.org",
  extensions: ["il y a 3 jours"],
  job_id: "test-only",
});
const form = () => ({
  title: job().title,
  companyName: job().company_name,
  companyWebsite: "https://example.org",
  city: "Nantes",
  region: "Pays de la Loire",
  domain: "Systèmes, réseaux & cloud",
  contract: "Stage",
  description: "Exemple fictif, Linux et Docker.",
  sourceUrl: job().source_link,
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  consent: true,
  sourceDateChecked: true,
});
test("Google Jobs staging never invents publication dates, locations or employer sites and cleans contacts", () => {
  const c = parseSerpCandidate(job());
  assert.equal(c.publishedAt, null);
  assert.equal(c.companyWebsite, undefined);
  assert.equal(c.region, undefined);
  assert.ok(!c.description.includes("recruteur@example.org"));
  assert.ok(c.publicationText.includes("3 jours"));
  assert.equal(
    parseSerpCandidate({ ...job(), title: "CDI informatique" }),
    null,
  );
  assert.equal(
    parseSerpCandidate({ ...job(), company_name: "CFA de test" }),
    null,
  );
  assert.equal(
    parseSerpCandidate({ ...job(), source_link: "https://google.com/search" }),
    null,
  );
  assert.equal(
    parseSerpCandidate({
      ...job(),
      detected_extensions: { posted_at: "2020-01-01" },
    }),
    null,
  );
  assert.equal(
    parseSerpCandidate({
      ...job(),
      source_link: undefined,
      apply_options: [{ link: "https://example.org/jobs/real-link" }],
    }).sourceUrl,
    "https://example.org/jobs/real-link",
  );
});
test("staging is private, idempotent, persistent and cannot publish without source date and eligible fields", async () => {
  const folder = await mkdtemp("/tmp/serp-inbox-");
  let store = new OfferStore(folder);
  try {
    let inbox = new SerpApiInbox(store);
    assert.deepEqual(
      inbox.stage([job(), job(), { ...job(), title: "Commercial CDI" }]),
      { created: 1, duplicate: 1, excluded: 1 },
    );
    assert.equal((await store.query()).total, 0);
    const id = inbox.list()[0].id;
    for (const change of [
      { publishedAt: "" },
      { sourceDateChecked: false },
      { publishedAt: "2020-01-01" },
      { domain: "Marketing" },
      { contract: "CDI" },
      { region: "Étranger" },
    ])
      await assert.rejects(inbox.submit(id, { ...form(), ...change }));
    const result = await inbox.submit(id, form());
    assert.equal(result.status, "pending");
    assert.equal(inbox.list().length, 0);
    const offer = (await store.read())[0];
    assert.equal(offer.lastVerifiedAt, null);
    assert.equal(offer.moderationStatus, "pending");
    assert.equal(offer.sourceId, "serpapi-google-jobs");
    assert.equal((await store.query()).total, 0);
    await assert.rejects(inbox.submit(id, form()));
    store.close();
    store = new OfferStore(folder);
    inbox = new SerpApiInbox(store);
    assert.equal(inbox.stage([job()]).duplicate, 1);
    const second = { ...job(), source_link: "https://example.org/jobs/second" };
    inbox.stage([second]);
    inbox.reject(parseSerpCandidate(second).id);
    assert.equal(inbox.list().length, 0);
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("Google Jobs import requires admin and rights attestation, shares quota with test and never auto-publishes", async () => {
  const folder = await mkdtemp("/tmp/serp-route-");
  let calls = 0;
  const token = "t".repeat(40);
  const app = createApp({
    folder,
    adminToken: token,
    serpApiOptions: {
      env: { SERPAPI_API_KEY: "fake-private-key" },
      fetcher: async () => {
        calls++;
        return new Response(JSON.stringify({ jobs_results: [job()] }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  try {
    assert.equal(
      (await fetch(base + "/api/admin/serpapi/candidates")).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/admin/serpapi/import", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      400,
    );
    assert.equal(calls, 0);
    const r = await (
      await fetch(base + "/api/admin/serpapi/import", {
        method: "POST",
        headers,
        body: JSON.stringify({
          rightsConfirmed: true,
          query: "stage informatique",
        }),
      })
    ).json();
    assert.equal(r.imported.created, 1);
    assert.equal(calls, 1);
    assert.equal(
      (
        await fetch(base + "/api/admin/serpapi/test", {
          method: "POST",
          headers,
        })
      ).status,
      429,
    );
    const list = await (
      await fetch(base + "/api/admin/serpapi/candidates", { headers })
    ).json();
    assert.equal(list.items.length, 1);
    assert.equal((await app.locals.store.query()).total, 0);
  } finally {
    await new Promise((r) => server.close(r));
    app.locals.store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
test("documented SerpApi dates between 30 and 45 days can pass the usual human review", async () => {
  const folder = await mkdtemp("/tmp/serp-review-");
  const store = new OfferStore(folder);
  try {
    const inbox = new SerpApiInbox(store);
    inbox.stage([job()]);
    const result = await inbox.submit(inbox.list()[0].id, {
      ...form(),
      publishedAt: new Date(Date.now() - 40 * 86400000)
        .toISOString()
        .slice(0, 10),
    });
    await assert.rejects(store.review(result.id, { action: "approve" }));
    await store.review(result.id, {
      action: "approve",
      sourceChecked: true,
      rightsChecked: true,
      companyChecked: true,
      contactChecked: true,
    });
    assert.equal((await store.query()).total, 1);
    assert.equal((await store.read())[0].sourceName, "Google Jobs via SerpApi");
  } finally {
    store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
