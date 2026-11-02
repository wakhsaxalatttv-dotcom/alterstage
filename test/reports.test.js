import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createApp } from "../server/app.js";
const token = "fictional-test-admin-token-not-a-real-secret";
const checks = {
  sourceChecked: true,
  rightsChecked: true,
  companyChecked: true,
  contactChecked: true,
};
async function run(options, fn) {
  const folder = await mkdtemp("/tmp/offres-reports-");
  const app = createApp({
    folder,
    adminToken: token,
    pipelineOptions: { sources: async () => [] },
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body, auth) =>
    fetch(base + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      body: JSON.stringify(body),
    });
  try {
    await fn({ base, app, post, folder });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    app.locals.store.close();
    await rm(folder, { recursive: true, force: true });
  }
}
const fixture = () => ({
  title: "Exemple fictif — modération et signalement",
  companyName: "Entreprise fictive de test",
  companyWebsite: "https://example.org",
  sourceUrl: "https://example.org/jobs/fiction",
  contract: "Stage",
  city: "Lyon",
  region: "Auvergne-Rhône-Alpes",
  domain: "Maintenance industrielle",
  description: "Exemple fictif uniquement pour un test isolé.",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  consent: true,
});
test("dépôt privé avant validation ; signalement privé reçu et retrait administrateur du catalogue", () =>
  run({}, async ({ base, post, app }) => {
    const submitted = await (await post("/api/submissions", fixture())).json();
    assert.equal(
      (await fetch(base + "/api/offers/" + submitted.id)).status,
      404,
    );
    assert.equal(
      (await post("/api/reports", { offerId: submitted.id, reason: "closed" }))
        .status,
      400,
    );
    assert.equal(
      (
        await post(
          `/api/admin/submissions/${submitted.id}/review`,
          { action: "approve" },
          token,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await post(
          `/api/admin/submissions/${submitted.id}/review`,
          { action: "approve", ...checks },
          token,
        )
      ).status,
      200,
    );
    const response = await post("/api/reports", {
      offerId: submitted.id,
      reason: "closed",
      details: "La candidature est fermée.",
      sourceUrl: "https://evil.example",
    });
    assert.equal(response.status, 201);
    const receipt = await response.json();
    assert.equal(receipt.status, "open");
    assert.equal(receipt.details, undefined);
    assert.equal(
      (await fetch(base + "/api/offers/" + submitted.id)).status,
      200,
    );
    assert.equal((await fetch(base + "/api/admin/reports")).status, 401);
    assert.equal(
      (
        await post(`/api/admin/reports/${receipt.id}/review`, {
          action: "withdraw",
        })
      ).status,
      401,
    );
    let list = await (
      await fetch(base + "/api/admin/reports", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    assert.equal(list.counts.open, 1);
    assert.equal(list.reports[0].details, "La candidature est fermée.");
    assert.equal(
      list.reports[0].offer.sourceUrl,
      "https://example.org/jobs/fiction",
    );
    assert.equal(
      (
        await post(
          `/api/admin/reports/${receipt.id}/review`,
          { action: "withdraw", note: "Fermeture constatée sur la source." },
          token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await fetch(base + "/api/offers/" + submitted.id)).status,
      404,
    );
    assert.equal((await app.locals.store.query()).total, 0);
    list = app.locals.reports.list({ status: "resolved" });
    assert.equal(list.reports[0].last_action, "withdraw");
    assert.equal(list.counts.open, 0);
  }));
test("signalement d’une référence, classement et retrait durable même après réouverture de la base", () =>
  run({}, async ({ base, app, post, folder }) => {
    const before = await (await fetch(base + "/api/references")).json();
    const target = before.offers[0];
    assert.ok(target);
    assert.equal(
      (await post("/api/reports", { offerId: target.id, reason: "bad" }))
        .status,
      400,
    );
    assert.equal(
      (await post("/api/reports", { offerId: "invented", reason: "closed" }))
        .status,
      400,
    );
    assert.equal(
      (
        await post("/api/reports", {
          offerId: target.id,
          reason: "closed",
          details: "x".repeat(1501),
        })
      ).status,
      400,
    );
    let receipt = await (
      await post("/api/reports", { offerId: target.id, reason: "incorrect" })
    ).json();
    assert.equal(
      (
        await post(
          `/api/admin/reports/${receipt.id}/review`,
          { action: "dismiss" },
          token,
        )
      ).status,
      200,
    );
    assert.equal(app.locals.reports.list({ status: "dismissed" }).total, 1);
    assert.ok(app.locals.reports.references().some((o) => o.id === target.id));
    receipt = await (
      await post("/api/reports", { offerId: target.id, reason: "closed" })
    ).json();
    assert.equal(
      (
        await post(
          `/api/admin/reports/${receipt.id}/review`,
          { action: "withdraw" },
          token,
        )
      ).status,
      200,
    );
    assert.ok(!app.locals.reports.references().some((o) => o.id === target.id));
    const reopened = createApp({
      folder,
      adminToken: token,
      pipelineOptions: { sources: async () => [] },
    });
    try {
      assert.ok(
        !reopened.locals.reports.references().some((o) => o.id === target.id),
      );
      assert.equal(
        reopened.locals.reports.list({ status: "resolved" }).total,
        1,
      );
    } finally {
      reopened.locals.store.close();
    }
  }));
test("signalements fermés sans modération configurée et limitation des envois", async () => {
  await run({ adminToken: "" }, async ({ post }) =>
    assert.equal(
      (await post("/api/reports", { offerId: "any", reason: "closed" })).status,
      503,
    ),
  );
  await run({}, async ({ app, post }) => {
    const target = app.locals.reports.references()[0];
    for (let i = 0; i < 10; i++)
      assert.equal(
        (await post("/api/reports", { offerId: target.id, reason: "closed" }))
          .status,
        201,
      );
    assert.equal(
      (await post("/api/reports", { offerId: target.id, reason: "closed" }))
        .status,
      429,
    );
  });
});
