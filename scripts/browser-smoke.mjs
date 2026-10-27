import { chromium } from "playwright";
import { createApp } from "../server/app.js";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const folder = await mkdtemp("/tmp/offres-ui-"),
  token = randomBytes(32).toString("hex");
const server = createApp({ folder, adminToken: token }).listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: base + url.pathname + url.search }),
    });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page
    .getByText("Des annonces d’entreprises, contrôlées avant publication", {
      exact: true,
    })
    .waitFor();
  await page.screenshot({ path: "/tmp/offres-v2-desktop.png", fullPage: true });
  await page.getByRole("button", { name: "Entreprises", exact: true }).click();
  await page.locator(".directory-card").first().waitFor();
  assert.equal(await page.locator(".directory-card").count(), 12);
  assert.match(
    await page.locator(".directory-actions a").nth(1).getAttribute("href"),
    /google.com\/search\?q=/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "directory mobile overflow",
  );
  await page
    .getByRole("button", { name: "Déposer une annonce", exact: true })
    .click();
  await page.screenshot({
    path: "/tmp/offres-v2-employer-mobile.png",
    fullPage: true,
  });
  const form = page.locator(".employer-form");
  await form.locator("[name=companyName]").fill("Entreprise fictive de test");
  await form.locator("[name=companyWebsite]").fill("https://example.org/");
  await form.locator("[name=city]").fill("Paris");
  await form
    .locator("[name=companyDescription]")
    .fill("Présentation fictive de test uniquement.");
  await form
    .locator("[name=title]")
    .fill("Exemple fictif — démonstration maintenance");
  await form.locator("[name=domain]").selectOption("Maintenance industrielle");
  await form.locator("[name=contract]").selectOption("Apprentissage");
  await form.locator("[name=region]").selectOption("Île-de-France");
  await form
    .locator("[name=description]")
    .fill("Description fictive de test, dans un dossier temporaire isolé.");
  await form
    .locator("[name=missions]")
    .fill("Mission fictive uniquement pour le test");
  await form
    .locator("[name=sourceUrl]")
    .fill("https://example.org/jobs/fixture");
  await form
    .locator("[name=publishedAt]")
    .fill(new Date().toISOString().slice(0, 10));
  await form
    .locator("[name=expiresAt]")
    .fill(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10));
  await form.locator("[name=publicEmail]").fill("recrutement@example.org");
  await form
    .locator("[name=contactProvenance]")
    .fill("https://example.org/contact");
  await form.locator("[name=contactConsent]").check();
  await form.locator("[name=consent]").check();
  await form.getByRole("button", { name: "Aperçu du dépôt" }).click();
  await page.getByText("BROUILLON — NON PUBLIÉ", { exact: true }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "form mobile overflow",
  );
  await form.getByRole("button", { name: "Soumettre à la validation" }).click();
  await page
    .getByRole("heading", { name: "Annonce reçue, en attente de validation" })
    .waitFor();
  assert.equal(
    (await (await fetch(base + "/api/offers")).json()).offers.length,
    0,
  );
  await page.getByRole("button", { name: "Modération", exact: true }).click();
  await page.getByLabel("Jeton de modération").fill(token);
  await page.getByRole("button", { name: "Accéder à la modération" }).click();
  await page.locator(".review-card").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Valider et publier", exact: true })
      .isEnabled(),
    false,
  );
  for (const checkbox of await page.locator(".review-checks input").all())
    await checkbox.check();
  await page
    .getByRole("button", { name: "Valider et publier", exact: true })
    .click();
  await page
    .getByText("Aucune annonce dans cette catégorie.", { exact: true })
    .waitFor();
  await page.locator(".brand").click();
  await page.locator(".offer-card").waitFor();
  await page.getByRole("button", { name: "Filtres", exact: true }).click();
  await page
    .getByLabel("Famille de métiers", { exact: true })
    .selectOption("Informatique");
  await page
    .getByText("Aucune offre ne correspond pour le moment", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Effacer tous les filtres", exact: true })
    .click();
  await page.locator(".offer-card").waitFor();
  await page
    .getByRole("button", { name: "Enregistrer en favoris", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Exemple fictif — démonstration maintenance",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("heading", { name: "Missions", exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "recrutement@example.org", exact: true })
    .waitFor();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Entreprise fictive de test", exact: true })
    .click();
  await page
    .getByText("Présentation fictive de test uniquement.", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mes favoris", exact: true }).click();
  assert.equal(await page.locator(".offer-card").count(), 1);
  await page.getByRole("button", { name: "Entreprises", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Entreprise", exact: true })
    .fill("fictive");
  await page
    .getByRole("button", { name: "Voir la fiche", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Modération", exact: true }).click();
  await page.getByLabel("Jeton de modération").fill(token);
  await page.getByRole("button", { name: "Accéder à la modération" }).click();
  await page
    .getByRole("button", { name: "Sources & collecte", exact: true })
    .click();
  await page.getByText("Source non configurée.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "Publiées (1)", exact: true }).click();
  await page.getByRole("button", { name: "Retirer", exact: true }).click();
  await page
    .getByText("Aucune annonce dans cette catégorie.", { exact: true })
    .waitFor();
  assert.equal(
    (await (await fetch(base + "/api/offers")).json()).offers.length,
    0,
  );
  // Check server-side pagination and counts with a larger isolated dataset.
  for (let n = 0; n < 24; n++) {
    const payload = {
      title: `Exemple fictif — démonstration ${n}`,
      companyName: "Entreprise fictive pagination",
      companyWebsite: "https://pagination.example.org/",
      sourceUrl: `https://pagination.example.org/jobs/${n}`,
      contract: "Stage",
      city: n % 2 ? "Nantes" : "Lyon",
      region: n % 2 ? "Pays de la Loire" : "Auvergne-Rhône-Alpes",
      domain: "Systèmes, réseaux & cloud",
      description:
        n % 2
          ? "Description fictive Linux Docker."
          : "Description fictive Windows Cisco.",
      publishedAt: new Date().toISOString().slice(0, 10),
      expiresAt: new Date(Date.now() + 10 * 86400000)
        .toISOString()
        .slice(0, 10),
      consent: true,
    };
    const imported = await fetch(base + "/api/admin/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    assert.equal(imported.status, 201);
    const { id } = await imported.json();
    const reviewed = await fetch(base + `/api/admin/submissions/${id}/review`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "approve",
        sourceChecked: true,
        rightsChecked: true,
        companyChecked: true,
        contactChecked: true,
      }),
    });
    assert.equal(reviewed.status, 200);
  }
  await page.reload();
  await page.locator(".offer-card").first().waitFor();
  assert.equal(await page.locator(".offer-card").count(), 20);
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await page
    .getByText("Page 2 sur 2 · 24 résultats", { exact: true })
    .waitFor();
  assert.equal(await page.locator(".offer-card").count(), 4);
  await page.getByRole("button", { name: "Filtres", exact: true }).click();
  await page.getByLabel("Ville", { exact: true }).fill("Nantes");
  await page.waitForFunction(
    () => document.querySelectorAll(".offer-card").length === 12,
  );
  await page
    .getByLabel("Technologie mentionnée", { exact: true })
    .selectOption("Docker");
  await page.waitForFunction(
    () => document.querySelectorAll(".offer-card").length === 12,
  );
  await page
    .getByRole("button", {
      name: "Exemple fictif — démonstration 1",
      exact: true,
    })
    .click();
  await page
    .getByRole("dialog")
    .getByText("Offre vérifiée · périmètre technique relu", { exact: true })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: "/tmp/offres-v3-mobile-results.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "results mobile overflow",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: mobile layout, directory, preview, real API submission in isolated store, authentication, mandatory checks, publication, scope filter, details, public contact provenance, company profile, favorites and withdrawal. No production offer was created.",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  server.listeners("request")[0].locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
