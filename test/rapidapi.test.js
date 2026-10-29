import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createApp } from "../server/app.js";
import {
  createRapidApiProbe,
  responseShape,
  RAPIDAPI_LINKEDIN_URL,
  RAPIDAPI_LINKEDIN_HOST,
} from "../server/ingestion/rapidapi-linkedin.js";
const env = { RAPIDAPI_LINKEDIN_KEY: "private-test-key-never-live" };
const sample = {
  data: [
    {
      id: "fiction-only",
      title: "Exemple fictif de poste",
      postedAt: "2026-10-29T09:00:00Z",
      url: "https://example.org/job/1",
      company: { name: "Entreprise fictive" },
      recruiter: { name: "Personne privée", email: "private@example.org" },
      description: "Email private@example.org et téléphone 0612345678",
      access_token: "private-token",
    },
  ],
};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
test("RapidAPI shape retains useful field names and types but never values, contacts or credentials", () => {
  const shape = responseShape(sample, env.RAPIDAPI_LINKEDIN_KEY);
  assert.equal(shape.data.type, "array");
  assert.equal(shape.data.first.title, "string");
  assert.equal(shape.data.first.postedAt, "string (date ISO)");
  assert.equal(shape.data.first.url, "string (URL HTTPS)");
  const text = JSON.stringify(shape);
  for (const forbidden of [
    "Personne privée",
    "private@example.org",
    "0612345678",
    "private-token",
    "Exemple fictif de poste",
    env.RAPIDAPI_LINKEDIN_KEY,
    "recruiter",
    "access_token",
  ])
    assert.ok(!text.includes(forbidden));
});
test("RapidAPI is never called without a configured key", async () => {
  const probe = createRapidApiProbe({
    env: {},
    fetcher: () => assert.fail("No network allowed"),
  });
  assert.equal(probe.configured(), false);
  assert.equal((await probe.run()).status, "not_configured");
});
test("RapidAPI test performs one fixed GET without secret URL or redirect and does not import offers", async () => {
  let calls = 0;
  const probe = createRapidApiProbe({
    env,
    fetcher: async (url, options) => {
      calls++;
      const parsed = new URL(url);
      assert.equal(parsed.origin + parsed.pathname, RAPIDAPI_LINKEDIN_URL);
      assert.equal(parsed.searchParams.get("location"), "France");
      assert.equal(parsed.searchParams.get("page"), "1");
      assert.equal(options.headers["x-rapidapi-host"], RAPIDAPI_LINKEDIN_HOST);
      assert.equal(
        options.headers["x-rapidapi-key"],
        env.RAPIDAPI_LINKEDIN_KEY,
      );
      assert.equal(options.redirect, "manual");
      assert.ok(!url.includes(env.RAPIDAPI_LINKEDIN_KEY));
      return json(sample);
    },
  });
  const result = await probe.run();
  assert.equal(result.status, "success");
  assert.equal(result.httpStatus, 200);
  assert.equal(calls, 1);
  assert.ok(!JSON.stringify(result).includes(env.RAPIDAPI_LINKEDIN_KEY));
  assert.ok(!("offers" in result));
});
test("RapidAPI quota is protected by cooldown, concurrency and per-instance hourly limit", async () => {
  let time = 0,
    calls = 0,
    complete;
  const probe = createRapidApiProbe({
    env,
    now: () => time,
    fetcher: () => {
      calls++;
      return new Promise((resolve) => {
        complete = () => resolve(json(sample));
      });
    },
  });
  const first = probe.run();
  assert.equal((await probe.run()).status, "limited");
  complete();
  await first;
  assert.equal((await probe.run()).status, "limited");
  for (let index = 0; index < 2; index++) {
    time += 61000;
    const result = probe.run();
    complete();
    await result;
  }
  time += 61000;
  assert.equal((await probe.run()).status, "limited");
  assert.equal(calls, 3);
});
test("RapidAPI errors are actionable and never echo arbitrary provider bodies or exceptions", async () => {
  for (const status of [401, 403, 429, 500]) {
    const probe = createRapidApiProbe({
      env,
      fetcher: async () => json({ message: env.RAPIDAPI_LINKEDIN_KEY }, status),
    });
    const result = await probe.run();
    assert.equal(result.status, "error");
    assert.equal(result.httpStatus, status);
    assert.ok(!JSON.stringify(result).includes(env.RAPIDAPI_LINKEDIN_KEY));
  }
  const probe = createRapidApiProbe({
    env,
    fetcher: async () => {
      throw Error(env.RAPIDAPI_LINKEDIN_KEY);
    },
  });
  assert.ok(
    !JSON.stringify(await probe.run()).includes(env.RAPIDAPI_LINKEDIN_KEY),
  );
});
test("RapidAPI diagnostic is private, persisted without secrets, and leaves the public catalogue unchanged", async () => {
  const folder = await mkdtemp("/tmp/offres-rapidapi-");
  let calls = 0;
  const token = "test-only-admin-" + "a".repeat(40);
  const app = createApp({
    folder,
    adminToken: token,
    pipelineOptions: { sources: async () => [] },
    rapidApiOptions: {
      env,
      fetcher: async () => {
        calls++;
        return json(sample);
      },
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(
      (await fetch(base + "/api/admin/rapidapi-linkedin")).status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/admin/rapidapi-linkedin/test", {
          method: "POST",
        })
      ).status,
      401,
    );
    assert.equal(calls, 0);
    const headers = { Authorization: `Bearer ${token}` };
    const before = await fetch(base + "/api/admin/rapidapi-linkedin", {
      headers,
    }).then((r) => r.json());
    assert.equal(before.configured, true);
    assert.equal(calls, 0);
    const response = await fetch(base + "/api/admin/rapidapi-linkedin/test", {
      method: "POST",
      headers,
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.status, "success");
    assert.equal((await app.locals.store.read()).length, 0);
    const persisted = app.locals.store.runs()[0];
    assert.equal(persisted.sourceId, "rapidapi-linkedin-test");
    const serialized = JSON.stringify(persisted);
    assert.ok(!serialized.includes(env.RAPIDAPI_LINKEDIN_KEY));
    assert.ok(!serialized.includes("private@example.org"));
    assert.equal(
      (
        await fetch(base + "/api/admin/rapidapi-linkedin/test", {
          method: "POST",
          headers,
        })
      ).status,
      429,
    );
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.close();
    await rm(folder, { recursive: true, force: true });
  }
});
