import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createApp } from "../server/app.js";
const payload = () => ({
  title: "Exemple fictif — démonstration technique",
  companyName: "Entreprise fictive de test",
  companyWebsite: "https://example.org/",
  sourceUrl: "https://example.org/jobs/fixture",
  contract: "Stage",
  city: "Lyon",
  region: "Auvergne-Rhône-Alpes",
  domain: "Maintenance industrielle",
  description:
    "Annonce fictive utilisée uniquement dans un répertoire temporaire de test.",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
  consent: true,
});
async function withServer(options, run) {
  const folder = await mkdtemp(path.join(os.tmpdir(), "offres-test-"));
  const server = createApp({ folder, ...options }).listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(url, folder);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(folder, { recursive: true, force: true });
  }
}
const token = "only-a-test-token-not-a-real-secret".repeat(2);
const post = (url, body, auth) =>
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    body: JSON.stringify(body),
  });
test("submission persists, remains private, requires human attestations, publishes then withdraws", () =>
  withServer({ adminToken: token }, async (url, folder) => {
    const submitted = await post(url + "/api/submissions", payload());
    assert.equal(submitted.status, 201);
    const receipt = await submitted.json();
    assert.equal(receipt.status, "pending");
    assert.equal(
      (await (await fetch(url + "/api/offers")).json()).offers.length,
      0,
    );
    assert.equal((await fetch(url + "/api/admin/submissions")).status, 401);
    assert.equal(
      (
        await post(
          url + `/api/admin/submissions/${receipt.id}/review`,
          { action: "approve" },
          token,
        )
      ).status,
      400,
    );
    const approve = await post(
      url + `/api/admin/submissions/${receipt.id}/review`,
      {
        action: "approve",
        sourceChecked: true,
        rightsChecked: true,
        companyChecked: true,
        contactChecked: true,
      },
      token,
    );
    assert.equal(approve.status, 200);
    const published = await (await fetch(url + "/api/offers")).json();
    assert.equal(published.offers.length, 1);
    assert.ok(published.offers[0].lastVerifiedAt);
    assert.equal(published.offers[0].source, "Dépôt direct de l’entreprise");
    assert.ok(
      JSON.parse(await readFile(path.join(folder, "offers.json"), "utf8"))[0]
        .lastVerifiedAt,
    );
    assert.equal((await post(url + "/api/submissions", payload())).status, 400);
    assert.equal(
      (
        await post(
          url + `/api/admin/submissions/${receipt.id}/review`,
          { action: "withdraw" },
          token,
        )
      ).status,
      200,
    );
    assert.equal(
      (await (await fetch(url + "/api/offers")).json()).offers.length,
      0,
    );
  }));
test("missing moderation configuration closes public deposits without losing a successful receipt", () =>
  withServer({ adminToken: "" }, async (url) => {
    assert.equal((await post(url + "/api/submissions", payload())).status, 503);
    assert.equal((await fetch(url + "/api/admin/submissions")).status, 503);
    assert.equal(
      (await (await fetch(url + "/api/offers")).json()).offers.length,
      0,
    );
  }));
test("unknown source publication date cannot pass moderation; administrator import stays pending", () =>
  withServer({ adminToken: token }, async (url) => {
    const imported = await post(
      url + "/api/admin/import",
      { ...payload(), publishedAt: "" },
      token,
    );
    assert.equal(imported.status, 201);
    const { id } = await imported.json();
    const result = await post(
      url + `/api/admin/submissions/${id}/review`,
      {
        action: "approve",
        sourceChecked: true,
        rightsChecked: true,
        companyChecked: true,
        contactChecked: true,
      },
      token,
    );
    assert.equal(result.status, 400);
    assert.equal(
      (await (await fetch(url + "/api/offers")).json()).offers.length,
      0,
    );
  }));
test("body limits and rate limits reject abuse", () =>
  withServer({ adminToken: token }, async (url) => {
    assert.equal(
      (
        await post(url + "/api/submissions", {
          ...payload(),
          description: "x".repeat(50000),
        })
      ).status,
      413,
    );
    for (let i = 0; i < 5; i++) await post(url + "/api/submissions", {});
    assert.equal((await post(url + "/api/submissions", payload())).status, 429);
  }));
