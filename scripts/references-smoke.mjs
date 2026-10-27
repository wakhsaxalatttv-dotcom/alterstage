import { chromium } from "playwright";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
import { selectOffers, defaultFilters } from "../src/domain.js";
import { externalOffers } from "../shared/external-offers.js";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Les références éditoriales restent utilisables même sans réponse de la source API.
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Source temporairement indisponible" }),
    }),
  );
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  const navigation = page.getByRole("navigation", {
    name: "Navigation principale",
  });
  await navigation
    .getByRole("button", { name: "Repérées", exact: true })
    .click();
  const section = page.locator("#offres-reperees");
  assert.equal(
    await section.locator("article").count(),
    selectOffers(externalOffers, defaultFilters).length,
  );
  assert.equal(
    await navigation
      .getByRole("button", { name: "Entreprises", exact: true })
      .isVisible(),
    true,
  );
  assert.equal(await section.locator(".verified-badge").count(), 0);
  assert.equal(await section.locator(".sector-visual").count(), 0);
  assert.doesNotMatch(
    await section.innerText(),
    /Offre ancienne|Dernière vérification/,
  );
  const entries = externalOffers.filter((offer) =>
    offer.id.startsWith("vinci-"),
  );
  for (const entry of entries) {
    const card = section.locator("article").filter({
      has: page.getByRole("heading", { name: entry.title, exact: true }),
    });
    assert.equal(
      await card
        .getByRole("link", { name: "Annonce officielle" })
        .getAttribute("href"),
      entry.sourceUrl,
    );
    await card.getByRole("button", { name: "Description détaillée" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("heading", { name: "Les missions" }).waitFor();
    assert.ok((await dialog.locator("li").count()) >= 3);
    assert.ok((await dialog.innerText()).includes(entry.profile));
    assert.equal(
      await dialog
        .getByRole("link", {
          name: "Voir l’annonce et candidater chez l’employeur",
        })
        .getAttribute("href"),
      entry.sourceUrl,
    );
    assert.equal(
      await dialog
        .getByRole("link", { name: "Site officiel du groupe" })
        .getAttribute("href"),
      "https://www.vinci.com",
    );
    assert.match(
      await dialog.innerText(),
      /Publication affichée par la source/,
    );
    assert.doesNotMatch(
      await dialog.innerText(),
      /Dernière vérification|Offre ancienne/,
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "detached" });
  }
  await section
    .getByRole("button", { name: "Chimie & matériaux", exact: true })
    .click();
  assert.equal(await section.locator("article").count(), 15);
  await section
    .locator("article")
    .first()
    .getByRole("button", { name: "Description détaillée" })
    .click();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /thermoplastiques|composites/i,
  );
  assert.match(
    await page
      .getByRole("dialog")
      .getByRole("link", {
        name: "Voir l’annonce et candidater chez l’employeur",
      })
      .getAttribute("href"),
    /safran-group\.com/,
  );
  await page.keyboard.press("Escape");
  await section.getByRole("button", { name: "Effacer les filtres" }).click();
  await section
    .getByRole("combobox", { name: "Région", exact: true })
    .selectOption("La Réunion");
  await section
    .getByRole("combobox", { name: "Domaine", exact: true })
    .selectOption("Maintenance industrielle");
  assert.equal(await section.locator("article").count(), 1);
  assert.match(
    await section.locator("article").innerText(),
    /Cegelec Réunion Ascenseurs/,
  );
  await section.getByRole("searchbox").fill("aucune-correspondance");
  assert.equal(await section.locator("article").count(), 0);
  await section
    .getByText("Aucun lien repéré ne correspond", { exact: false })
    .waitFor();
  await section.getByRole("button", { name: "Effacer les filtres" }).click();
  await section
    .getByRole("combobox", { name: "Publication", exact: true })
    .selectOption("30");
  assert.ok(
    (await section.locator("article").count()) <
      selectOffers(externalOffers, defaultFilters).length,
  );
  assert.equal(
    await section
      .locator("article")
      .filter({ hasText: "Offre ancienne" })
      .count(),
    0,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Débordement à ${width}px`,
    );
  }
  await page.screenshot({ path: "/tmp/offres-reperees.png", fullPage: false });
  assert.deepEqual(errors, []);
  console.log(
    "Repérées : navigation mobile/ordinateur, fiches et quinze stages chimie, provenance, filtres combinés, dates anciennes et état vide validés.",
  );
} finally {
  await browser.close();
}
