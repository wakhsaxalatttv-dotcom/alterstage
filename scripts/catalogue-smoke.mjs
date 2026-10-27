import { mkdtemp, rm, readFile } from "node:fs/promises";
import { createApp } from "../server/app.js";
import { seedBundledCatalogue } from "../server/ingestion/bundled.js";
import { publicOffer } from "../server/domain.js";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const folder = await mkdtemp("/tmp/offres-render-proof-"),
  app = createApp({
    folder,
    adminToken: "",
    pipelineOptions: { sources: async () => [] },
  });
await seedBundledCatalogue(app.locals.store);
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  const text = await readFile(
      new URL("../config/market-offers.json", import.meta.url),
      "utf8",
    ),
    snapshot = JSON.parse(text);
  const expected = snapshot.offers.filter((o) =>
    publicOffer({ ...o, moderationStatus: "approved" }),
  ).length;
  const response = await (await fetch(base + "/api/offers")).json();
  assert.equal(response.total, expected);
  assert.ok(
    response.offers.every((o) => !o.lastVerifiedAt && o.sourcePolicyApproved),
  );
  assert.equal(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text), false);
  if (process.env.LBA_API_KEY)
    assert.equal(text.includes(process.env.LBA_API_KEY), false);
  browser = await chromium.launch({
    executablePath:
      process.env.BROWSER_EXECUTABLE ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: base + u.pathname + u.search }),
    });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  if (expected) {
    await page.locator(".offer-card").first().waitFor();
    assert.equal(
      await page.locator(".offer-card").count(),
      Math.min(expected, 20),
    );
    assert.equal(await page.locator(".verified-badge").count(), 0);
    assert.equal(await page.locator(".source-active-note").count(), 0);
    assert.equal(await page.getByText(/Signalée active par/).count(), 0);
    assert.doesNotMatch(
      await page.locator(".offer-card").first().innerText(),
      /Offre ancienne|Dernière vérification/,
    );
    assert.equal(await page.locator(".career-banner").count(), 0);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.screenshot({
      path: "/tmp/offres-real-catalogue.png",
      fullPage: false,
    });
    await page.locator(".offer-card h3 button").first().click();
    await page
      .getByRole("dialog")
      .getByRole("heading", { name: "Description du poste", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("dialog").locator(".verified-badge").count(),
      0,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    `Déploiement neuf sans clé : ${expected} offres API visibles, dates originales conservées, aucun badge de vérification ni secret/contact personnel dans l’instantané. Mobile et détail contrôlés.`,
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
