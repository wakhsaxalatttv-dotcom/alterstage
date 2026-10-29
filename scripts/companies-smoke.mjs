import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { normalizeSubmission } from "../server/domain.js";
const folder = await mkdtemp("/tmp/offres-company-ui-");
const token = randomBytes(32).toString("hex");
const app = createApp({
  folder,
  adminToken: token,
  pipelineOptions: { sources: async () => [] },
});
const offer = normalizeSubmission({
  title: "Exemple fictif — stage réseau",
  companyName: "Atelier fictif réseau",
  companyWebsite: "https://atelier-fictif.example.org",
  sourceUrl: "https://example.org/jobs/fiction-only",
  description: "Exemple fictif pour ce test isolé uniquement. Linux et Cisco.",
  domain: "Systèmes, réseaux & cloud",
  contract: "Stage",
  city: "Nantes",
  region: "Pays de la Loire",
  publishedAt: new Date().toISOString().slice(0, 10),
  expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
  consent: true,
});
await app.locals.store.submit(offer);
await app.locals.store.review(offer.id, {
  action: "approve",
  companyChecked: true,
  sourceChecked: true,
  rightsChecked: true,
  contactChecked: true,
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
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: api + url.pathname + url.search }),
    });
  });
  await page.goto(base);
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await nav.getByRole("button", { name: "Entreprises", exact: true }).click();
  await page.getByLabel("Entreprise", { exact: true }).fill("Jolicode");
  await page
    .locator(".directory-card")
    .filter({ hasText: "JoliCode" })
    .waitFor();
  assert.equal(
    await page.locator(".directory-card .company-hosting.reviewed").count(),
    0,
  );
  await page.getByLabel("Entreprise", { exact: true }).fill("Atelier fictif");
  const company = page
    .locator(".directory-card")
    .filter({ hasText: "Atelier fictif réseau" });
  await company.waitFor();
  await company
    .getByRole("button", { name: "Voir ses offres", exact: true })
    .click();
  await page
    .locator(".company-scope")
    .getByText("Offres de Atelier fictif réseau", { exact: true })
    .waitFor();
  await page
    .locator(".offer-card")
    .filter({ hasText: "Exemple fictif — stage réseau" })
    .waitFor();
  assert.equal(
    await nav
      .getByRole("button", { name: "Les offres", exact: true })
      .getAttribute("aria-current"),
    "page",
  );
  await page.goto(new URL("/administration/", base).href);
  await page.getByLabel("Code d’accès").fill(token);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByRole("button", { name: "Entreprises", exact: true }).click();
  await page.getByLabel("Entreprise", { exact: true }).fill("Atelier fictif");
  await company.waitFor();
  await company
    .getByRole("button", { name: "Voir la fiche", exact: true })
    .click();
  const form = page.locator(".company-review-form");
  await form.waitFor();
  await form
    .getByLabel("Source des conditions d’accueil", { exact: true })
    .fill("https://example.org/criteria-fiction");
  await form.getByRole("checkbox", { name: "Stage", exact: true }).check();
  await form
    .getByLabel("Rythmes explicitement acceptés", { exact: true })
    .fill("3 semaines / 1 semaine");
  await form
    .getByLabel("Taille documentée", { exact: true })
    .selectOption("10–49 salariés");
  await form
    .getByLabel("Technologies déclarées par l’entreprise", { exact: true })
    .fill("Linux; Cisco");
  await form
    .getByLabel("Agences ou implantations sourcées", { exact: true })
    .fill("Nantes; Paris");
  for (const name of [
    "Identité de l’entreprise contrôlée.",
    "Source publique consultée et informations relues.",
    "Contrats et conditions d’accueil confirmés par cette source.",
  ])
    await form.getByRole("checkbox", { name, exact: true }).check();
  await form
    .getByRole("button", {
      name: "Enregistrer le contrôle d’accueil",
      exact: true,
    })
    .click();
  await page
    .getByText(
      "Contrôle enregistré. Le statut public et les filtres ont été actualisés.",
      { exact: true },
    )
    .waitFor();
  await page.goto(base);
  await nav.getByRole("button", { name: "Entreprises", exact: true }).click();
  await page
    .getByRole("button", { name: "Filtres entreprises", exact: true })
    .click();
  await page.getByLabel("Accueil", { exact: true }).selectOption("reviewed");
  await page
    .getByLabel("Contrat accueilli ou proposé", { exact: true })
    .selectOption("Stage");
  await page.getByLabel("Ville ou agence", { exact: true }).fill("Paris");
  await company.waitFor();
  assert.equal(await page.locator(".directory-card").count(), 1);
  await company
    .getByRole("button", { name: "Voir la fiche", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("heading", {
      name: "Critères d’accueil documentés",
      exact: true,
    })
    .waitFor();
  assert.match(await dialog.innerText(), /3 semaines \/ 1 semaine/);
  assert.equal(
    await dialog
      .getByRole("link", {
        name: "Source des conditions d’accueil",
        exact: true,
      })
      .getAttribute("href"),
    "https://example.org/criteria-fiction",
  );
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
  assert.equal((await app.locals.store.query()).total, 1);
  console.log(
    "Entreprises : sources distinctes des accueils, validation privée, filtres combinés, critères sourcés, accès à la rubrique Offres et responsive validés. Aucun test dans le catalogue réel.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
