import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const folder = await mkdtemp("/tmp/serpapi-automatic-ui-");
const token = randomBytes(32).toString("hex"),
  key = "test-only-serpapi-key";
let calls = 0;
const fakeJob = {
  title: "Alternance développement logiciel — exemple fictif",
  company_name: "Entreprise fictive",
  location: "Paris, France",
  source_link: "https://example.org/jobs/automatic",
  description: "Exemple fictif : Linux et Docker. contact@example.org",
  extensions: ["il y a 3 jours", "Temps plein"],
};
const app = createApp({
  folder,
  adminToken: token,
  pipelineOptions: { sources: async () => [] },
  serpApiOptions: {
    env: { SERPAPI_API_KEY: key },
    fetcher: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          jobs_results: [
            fakeJob,
            {
              ...fakeJob,
              source_link: "https://example.org/no-date",
              detected_extensions: undefined,
              extensions: [],
            },
            { ...fakeJob, via: "Meteojob" },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  },
  serpAutomationOptions: {
    env: {},
    resolveLocation: async () => ({
      city: "Paris",
      region: "Île-de-France",
      commune: "75056",
      provenance: "https://geo.api.gouv.fr/decoupage-administratif/communes",
    }),
  },
});
await app.locals.serpApiAutomation.tick();
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: api + url.pathname + url.search }),
    });
  });
  const base = process.env.BASE_URL || "http://127.0.0.1:5173";
  await page.goto(base);
  await page.locator(".offer-card").first().waitFor();
  assert.equal(await page.locator(".offer-card").count(), 1);
  assert.equal(await page.locator(".verified-badge").count(), 0);
  assert.ok(
    !(await page.locator("body").innerText()).includes("contact@example.org"),
  );
  assert.equal(calls, 1);
  const publicOffer = (await app.locals.store.query()).offers[0];
  assert.equal(publicOffer.publishedAt, null);
  assert.equal(publicOffer.contract, "Alternance — type non précisé");
  await page.getByText(/Publication Google Jobs.*il y a 3 jours/).waitFor();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Carte relative déborde à ${width}px`,
    );
  }
  await page.locator(".offer-card h3 button").first().click();
  await page
    .getByRole("dialog")
    .getByText(/Date exacte non fournie/)
    .waitFor();
  assert.equal((await app.locals.store.query()).total, 1);
  await page.goto(new URL("/administration/", base).href);
  await page.getByLabel("Code d’accès").fill(token);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("button", { name: "Sources & collecte", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Google Jobs — actualisation automatique" })
    .waitFor();
  await page.getByText(/1 \/ 42 recherches effectuées/).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Importer Google Jobs", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Tester SerpApi", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Lancer une collecte", exact: true })
      .count(),
    0,
  );
  assert.ok(!(await page.locator("body").innerText()).includes(key));
  assert.equal(calls, 1);
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
    "Google Jobs automatique : offre admissible publiée sans clic, données incomplètes privées, Meteojob exclu, aucun faux badge, suivi sans bouton d’import, mobile/PC validés.",
  );
} finally {
  await browser.close();
  await app.locals.serpApiAutomation.stop();
  await new Promise((r) => server.close(r));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
