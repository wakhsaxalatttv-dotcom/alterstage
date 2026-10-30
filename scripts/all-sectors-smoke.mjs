import { seedBundledCatalogue } from "../server/ingestion/bundled.js";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { normalizeSubmission } from "../server/domain.js";
import { seedEditorialCatalogue } from "../server/ingestion/editorial-catalogue.js";
const folder = await mkdtemp("/tmp/offres-all-sectors-ui-");
const app = createApp({ folder, pipelineOptions: { sources: async () => [] } });
await seedBundledCatalogue(app.locals.store);
const liveCount = (await app.locals.store.query()).total;
const seeded = await seedEditorialCatalogue(app.locals.store);
const fakeBase = {
  companyName: "PME fictive — test uniquement",
  companyWebsite: "https://example.org",
  city: "Nantes",
  region: "Pays de la Loire",
  description: "Exemple fictif, réservé à cette base de test.",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  consent: true,
};
for (const [title, domain, contract, path] of [
  [
    "Exemple fictif alternance RH",
    "Ressources humaines",
    "Apprentissage",
    "rh",
  ],
  [
    "Exemple fictif stage comptabilité",
    "Comptabilité, finance & audit",
    "Stage",
    "finance",
  ],
]) {
  const offer = normalizeSubmission({
    ...fakeBase,
    title,
    domain,
    contract,
    sourceUrl: `https://example.org/jobs/${path}`,
  });
  offer.moderationStatus = "approved";
  await app.locals.store.submit(offer);
}
const expected = liveCount + seeded.created + 2;
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const api = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const u = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: api + u.pathname + u.search }),
    });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.locator(".offer-card").first().waitFor();
  assert.equal((await app.locals.store.query()).total, expected);
  assert.equal(await page.locator(".verified-badge").count(), 0);
  await page
    .getByLabel("Rechercher un métier, une entreprise ou un domaine")
    .fill("Exemple fictif alternance RH");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelectorAll(".offer-card").length === 1,
  );
  await page
    .getByRole("combobox", { name: "Domaine", exact: true })
    .selectOption("Ressources humaines");
  await page
    .getByRole("heading", { name: "Exemple fictif alternance RH", exact: true })
    .waitFor();
  assert.equal(await page.locator(".offer-card").count(), 1);
  await page
    .getByRole("navigation", { name: "Navigation principale" })
    .getByRole("button", { name: "Repérées", exact: true })
    .click();
  const section = page.locator("#offres-reperees");
  await section.locator("article").first().waitFor();
  await section
    .getByRole("searchbox", { name: "Métier, entreprise ou domaine" })
    .fill("PME fictive");
  assert.ok(
    await section
      .getByRole("combobox", { name: "Contrat", exact: true })
      .isVisible(),
  );
  await section
    .getByRole("combobox", { name: "Contrat", exact: true })
    .selectOption("Apprentissage");
  await section
    .getByRole("heading", { name: "Exemple fictif alternance RH", exact: true })
    .waitFor();
  assert.equal(await section.locator("article").count(), 1);
  await section.getByRole("button", { name: "Description détaillée" }).click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Description du poste" })
    .waitFor();
  await page.keyboard.press("Escape");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Débordement ${width}px`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    `Tous secteurs : ${liveCount + seeded.created} annonces sourcées dont ${liveCount} reçues par API disponibles sur base propre, plus deux tests fictifs isolés ; RH/comptabilité, PME stage/alternance, filtres et mobile/PC validés.`,
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
