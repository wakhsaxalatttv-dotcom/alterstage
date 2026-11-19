import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createApp } from "../server/app.js";
import {
  candidateProvider,
  fixturePassword,
} from "./helpers/candidate-provider.js";
import { candidateClient } from "../server/candidates/supabase.js";
const adminToken = "only-test-admin-not-a-production-secret".repeat(2);
export async function accountFixture(options = {}) {
  const provider = await candidateProvider(),
    folder = await mkdtemp("/tmp/of-accounts-");
  const app = createApp({
    folder,
    adminToken,
    pipelineOptions: { sources: async () => [] },
    candidateOptions: {
      enabled: true,
      secureCookies: false,
      fetcher: provider.fetcher,
      env: { SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key" },
      mailer: { ready: false },
      ...options,
    },
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const client = () => {
    let cookies = new Map(),
      csrf;
    return {
      expireAccess() {
        cookies.delete("of_access");
      },
      get cookie() {
        return [...cookies].map(([k, v]) => k + "=" + v).join("; ");
      },
      async call(
        path,
        { method = "GET", body, headers = {}, useCsrf = true } = {},
      ) {
        const response = await fetch(base + "/api/account" + path, {
          method,
          headers: {
            Cookie: this.cookie,
            ...(csrf && useCsrf ? { "X-CSRF-Token": csrf } : {}),
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...headers,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        for (const h of response.headers.getSetCookie()) {
          const [kv] = h.split(";");
          const i = kv.indexOf("=");
          cookies.set(kv.slice(0, i), kv.slice(i + 1));
        }
        const data = await response.json();
        if (data.csrf) csrf = data.csrf;
        return { response, data };
      },
    };
  };
  return {
    app,
    base,
    provider,
    client,
    async close() {
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
      app.locals.store.close();
      await provider.close();
      await rm(folder, { recursive: true, force: true });
    },
  };
}
test("account HTTP flow: verified email, opaque cookies, CSRF, real PostgreSQL history, cross-user isolation and deletion", async () => {
  const f = await accountFixture();
  try {
    const a = f.client(),
      b = f.client();
    assert.equal((await a.call("/config")).data.enabled, true);
    const body = {
      email: "alice@example.org",
      password: fixturePassword,
      firstName: "Alice",
      lastName: "Test",
      acceptPrivacy: true,
    };
    assert.equal(
      (await a.call("/register", { method: "POST", body })).response.status,
      202,
    );
    assert.equal(f.provider.mail.length, 1);
    assert.equal(
      (await a.call("/login", { method: "POST", body })).response.status,
      401,
    );
    await f.provider.confirm(body.email);
    const login = await a.call("/login", { method: "POST", body });
    assert.equal(login.response.status, 200);
    assert.equal(login.data.user.firstName, "Alice");
    assert.equal(login.data.access_token, undefined);
    a.expireAccess();
    const renewed = await a.call("/me");
    assert.equal(renewed.response.status, 200);
    assert.equal(renewed.data.user.email, body.email);
    assert.ok(
      renewed.response.headers
        .getSetCookie()
        .some((c) => c.startsWith("of_access=")),
    );
    for (const cookie of login.response.headers.getSetCookie())
      assert.match(cookie, /HttpOnly; SameSite=Lax/);
    assert.equal(
      (
        await a.call("/profile", {
          method: "PATCH",
          body: { firstName: "A", lastName: "B" },
          useCsrf: false,
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await a.call("/profile", {
          method: "PATCH",
          body: { firstName: "A", lastName: "B" },
          headers: { Origin: "https://foreign.example" },
        })
      ).response.status,
      403,
    );
    assert.equal(
      (
        await a.call("/profile", {
          method: "PATCH",
          body: { firstName: "Alice", lastName: "Test" },
        })
      ).response.status,
      200,
    );
    // Real rows use the same migration and RLS as production. Test offers stay in memory only.
    const offer = {
      id: "fixture-local-only",
      title: "Offre fictive locale",
      company: { name: "Entreprise fictive" },
      location: { label: "Lyon" },
      domain: "Commerce",
      contract: "Stage",
      applicationUrl: "https://example.org/apply",
      sourceUrl: "https://example.org/offer",
    };
    f.app.locals.store.getPublic = async (id) =>
      id === offer.id ? offer : null;
    const click = await a.call("/click", {
      method: "POST",
      body: { offerId: offer.id },
    });
    assert.equal(click.response.status, 200);
    assert.equal(click.data.application.status, "intent");
    const id = click.data.application.id;
    assert.equal(
      (await a.call("/applications?pending=true")).data.applications.length,
      1,
    );
    const u = await f.provider.addUser("bob@example.org");
    await b.call("/login", {
      method: "POST",
      body: { email: u.email, password: fixturePassword },
    });
    assert.equal((await b.call("/applications")).data.applications.length, 0);
    assert.equal(
      (
        await b.call("/applications/" + id + "/confirm", {
          method: "POST",
          body: { applied: true },
        })
      ).response.status,
      404,
    );
    assert.equal(
      (
        await a.call("/applications/" + id + "/confirm", {
          method: "POST",
          body: { applied: true },
        })
      ).data.application.status,
      "applied",
    );
    assert.equal(
      (await a.call("/click", { method: "POST", body: { offerId: offer.id } }))
        .data.application.status,
      "applied",
    );
    assert.equal(
      (
        await a.call("/applications/" + id, {
          method: "PATCH",
          body: {
            status: "interview",
            note: "Entretien vendredi",
            nextActionAt: "2026-12-01T10:00:00Z",
          },
        })
      ).data.application.status,
      "interview",
    );
    assert.equal(
      (await a.call("/applications/" + id + "/events")).data.events.length,
      2,
    );
    assert.equal(
      (
        await a.call("/alerts", {
          method: "POST",
          body: { name: "Recherche banque", filters: { query: "banque" } },
        })
      ).response.status,
      201,
    );
    assert.equal(
      (
        await a.call("/alerts", {
          method: "POST",
          body: { name: "Sans mail", emailEnabled: true },
        })
      ).response.status,
      503,
    );
    assert.equal((await b.call("/alerts")).data.alerts.length, 0);
    const exported = (await a.call("/export")).data;
    assert.equal(exported.of_applications.length, 1);
    assert.equal(exported.profile.email, body.email);
    assert.equal(JSON.stringify(exported).includes(fixturePassword), false);
    assert.equal((await fetch(f.base + "/api/admin/candidates")).status, 401);
    const stats = await (
      await fetch(f.base + "/api/admin/candidates", {
        headers: { Authorization: "Bearer " + adminToken },
      })
    ).json();
    assert.equal(stats.stats.applications, 1);
    const accountPage = await fetch(f.base + "/compte");
    assert.match(accountPage.headers.get("x-robots-tag"), /noindex/);
    assert.equal(
      (await a.call("/", { method: "DELETE", body: { password: "wrong" } }))
        .response.status,
      400,
    );
    assert.equal(
      (
        await a.call("/", {
          method: "DELETE",
          body: { password: fixturePassword },
        })
      ).response.status,
      200,
    );
    assert.equal((await a.call("/me")).data.user, null);
    assert.equal(
      (
        await f.provider.db.query(
          "SELECT count(*) AS n FROM public.of_applications",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await f.close();
  }
});
test("provider failures redact private details; unsubscribe signatures are scoped and constant-sized", async () => {
  const c = candidateClient({
    env: { SUPABASE_SERVICE_ROLE_KEY: "fixture-secret" },
    fetcher: async () =>
      new Response(JSON.stringify({ message: "PRIVATE_SECRET_OR_ADDRESS" }), {
        status: 500,
      }),
  });
  await assert.rejects(
    c.call("/rest/v1/of_profiles"),
    (e) => !e.message.includes("PRIVATE"),
  );
  const token = c.unsubscribeToken("alice");
  assert.equal(c.validUnsubscribe("alice", token), true);
  assert.equal(c.validUnsubscribe("bob", token), false);
  assert.equal(c.validUnsubscribe("alice", "x"), false);
});
test("new-offer alerts exclude old and withdrawn offers, deduplicate, send opt-in digests and support signed unsubscribe", async () => {
  const sent = [],
    f = await accountFixture({
      mailer: { ready: true, send: async (data) => sent.push(data) },
    });
  try {
    const user = await f.provider.addUser("alerts@example.org"),
      a = f.client();
    await a.call("/login", {
      method: "POST",
      body: { email: user.email, password: fixturePassword },
    });
    async function publish(slug) {
      const post = async (path, body) =>
        fetch(f.base + path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + adminToken,
          },
          body: JSON.stringify(body),
        });
      const created = await post("/api/admin/import", {
        title: "Stage test banque " + slug,
        companyName: "Entreprise fictive " + slug,
        companyWebsite: "https://example.org/",
        sourceUrl: "https://example.org/test/" + slug,
        contract: "Stage",
        city: "Lyon",
        region: "Auvergne-Rhône-Alpes",
        domain: "Banque, assurance & immobilier",
        description:
          "Offre fictive strictement réservée aux tests locaux du suivi des nouvelles offres.",
        publishedAt: new Date().toISOString().slice(0, 10),
        expiresAt: new Date(Date.now() + 864000000).toISOString().slice(0, 10),
        consent: true,
      });
      assert.equal(created.status, 201);
      const { id } = await created.json();
      const approved = await post("/api/admin/submissions/" + id + "/review", {
        action: "approve",
        sourceChecked: true,
        rightsChecked: true,
        companyChecked: true,
        contactChecked: true,
      });
      assert.equal(approved.status, 200);
      return id;
    }
    await publish("old");
    assert.equal(
      (
        await a.call("/alerts", {
          method: "POST",
          body: {
            name: "Banque",
            filters: { query: "banque" },
            emailEnabled: true,
          },
        })
      ).response.status,
      201,
    );
    await publish("new");
    const closed = await publish("closed");
    await f.app.locals.store.review(closed, { action: "withdraw" });
    const run = await f.app.locals.candidateAccounts.processAlerts();
    assert.equal(run.matched, 1);
    assert.equal(run.emails, 1);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, user.email);
    assert.match(sent[0].text, /banque new/);
    assert.doesNotMatch(sent[0].text, /banque old|banque closed/);
    assert.deepEqual(await f.app.locals.candidateAccounts.processAlerts(), {
      matched: 0,
      emails: 0,
    });
    assert.equal(sent.length, 1);
    const notifications = (await a.call("/notifications")).data.notifications;
    assert.equal(notifications.length, 1);
    assert.equal(
      (await a.call("/alerts/check", { method: "POST" })).data.created,
      0,
    );
    const link = sent[0].text.match(/#unsubscribe=([^\s]+)/)[1];
    const [id, token] = link.split(".");
    const anonymous = f.client();
    assert.equal(
      (
        await anonymous.call("/unsubscribe", {
          method: "POST",
          body: { id, token },
        })
      ).response.status,
      200,
    );
    assert.equal((await a.call("/alerts")).data.alerts[0].email_enabled, false);
    assert.equal(
      (
        await anonymous.call("/unsubscribe", {
          method: "POST",
          body: { id, token: "invalid" },
        })
      ).response.status,
      403,
    );
  } finally {
    await f.close();
  }
});
