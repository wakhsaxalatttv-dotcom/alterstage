import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const folder = await mkdtemp("/tmp/offres-serpapi-ui-");
const token = randomBytes(32).toString("hex"),
  key = "test-only-private-key";
let calls = 0;
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
            {
              title: "Stage informatique — exemple fictif",
              company_name: "Entreprise fictive",
              location: "Nantes, France",
              description:
                "Exemple fictif : Linux et Docker. contact@example.org",
              source_link: "https://example.org/job",
              url: "https://example.org/job",
              publishedAt: "2026-10-29T09:00:00Z",
              recruiter: { email: "private@example.org" },
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    },
  },
});
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const api = `http://127.0.0.1:${server.address().port}`;
const base = process.env.BASE_URL || "http://127.0.0.1:5173";
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
  await page.goto(base);
  assert.equal(
    await page
      .getByRole("button", { name: "Tester SerpApi", exact: true })
      .count(),
    0,
  );
  await page.goto(new URL("/administration/", base).href);
  assert.equal(
    await page
      .getByRole("button", { name: "Tester SerpApi", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Code d’accès").fill(token);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("button", { name: "Sources & collecte", exact: true })
    .click();
  const button = page.getByRole("button", {
    name: "Tester SerpApi",
    exact: true,
  });
  await button.waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (b) => b.textContent === "Tester SerpApi" && !b.disabled,
    ),
  );
  assert.equal(calls, 0);
  const importButton = page.getByRole("button", {
    name: "Importer Google Jobs",
    exact: true,
  });
  assert.equal(await importButton.isDisabled(), true);
  await page
    .getByRole("checkbox", { name: /Je confirme disposer des droits/ })
    .check();
  await importButton.click();
  await page
    .getByRole("button", { name: "Compléter pour validation", exact: true })
    .click();
  const form = page.locator("form.employer-form");
  await form.waitFor();
  assert.equal(
    await form.locator('[name="title"]').inputValue(),
    "Stage informatique — exemple fictif",
  );
  assert.equal(await form.locator('[name="publishedAt"]').inputValue(), "");
  assert.ok(
    !(await form.locator('[name="description"]').inputValue()).includes(
      "contact@example.org",
    ),
  );
  await form.locator('[name="companyWebsite"]').fill("https://example.org");
  await form.locator('[name="city"]').fill("Nantes");
  await form
    .locator('[name="domain"]')
    .selectOption("Systèmes, réseaux & cloud");
  await form.locator('[name="contract"]').selectOption("Stage");
  await form.locator('[name="region"]').selectOption("Pays de la Loire");
  await form
    .locator('[name="publishedAt"]')
    .fill(new Date().toISOString().slice(0, 10));
  await form
    .locator('[name="expiresAt"]')
    .fill(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  await form.locator('[name="consent"]').check();
  await form.locator('[name="sourceDateChecked"]').check();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      JSON.stringify(
        await page.evaluate(() =>
          [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > innerWidth)
            .slice(-15)
            .map((e) => ({
              tag: e.tagName,
              cls: e.className,
              name: e.name,
              w: e.getBoundingClientRect().width,
            })),
        ),
      ),
    );
  }
  await form.getByRole("button", { name: "Soumettre à la validation" }).click();
  await page
    .getByText(
      "Annonce transmise à la rubrique En attente. Elle reste non publiée.",
    )
    .waitFor();
  assert.equal(calls, 1);
  const offers = await app.locals.store.read();
  assert.equal(offers.length, 1);
  assert.equal(offers[0].moderationStatus, "pending");
  assert.equal((await app.locals.store.query()).total, 0);
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
    "Import SerpApi : droits requis, un seul appel, formulaire prérempli, date manquante conservée, contacts retirés, soumission privée et responsive validés.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
