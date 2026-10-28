import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const folder = await mkdtemp("/tmp/offres-report-ui-"),
  token = randomBytes(32).toString("hex");
const app = createApp({
    folder,
    adminToken: token,
    pipelineOptions: { sources: async () => [] },
  }),
  server = app.listen(0, "127.0.0.1");
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
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: base + url.pathname + url.search }),
    });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  assert.equal(
    await page.getByRole("button", { name: "Gestion", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Modération", exact: true }).count(),
    0,
  );
  assert.equal(await page.locator('a[href^="/administration"]').count(), 0);
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /ADMIN_TOKEN|Sur Render/,
  );
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await nav.getByRole("button", { name: "Repérées", exact: true }).click();
  const first = page.locator(".external-card").first();
  await first.waitFor();
  const originalUrl = await first
    .getByRole("link", { name: "Annonce officielle" })
    .getAttribute("href");
  const shortcuts = page.getByRole("group", { name: "Raccourcis par domaine" });
  assert.ok((await shortcuts.getByRole("button").count()) > 3);
  await first.getByRole("button", { name: "Description détaillée" }).click();
  let dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Signaler une offre fermée ou incorrecte" })
    .click();
  await dialog.getByLabel("Motif", { exact: true }).selectOption("closed");
  await dialog
    .getByLabel("Précisions (facultatif)", { exact: true })
    .fill("Exemple fictif — test isolé de signalement.");
  await dialog.getByRole("button", { name: "Envoyer le signalement" }).click();
  await dialog
    .getByText("Signalement transmis au responsable du site. Merci.", {
      exact: true,
    })
    .waitFor();
  await page.keyboard.press("Escape");
  await page.goto(
    new URL("/administration/", process.env.BASE_URL || "http://127.0.0.1:5173")
      .href,
  );
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /ADMIN_TOKEN|Render|Quatre|aucun lien saisi/,
  );
  await page.getByLabel("Code d’accès").fill(token);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await page.getByRole("button", { name: "Signalements", exact: true }).click();
  const report = page.locator(".report-card");
  await report.waitFor();
  assert.match(await report.innerText(), /Exemple fictif — test isolé/);
  await report
    .getByLabel("Note de traitement")
    .fill("Retrait effectué dans le test isolé.");
  await report
    .getByRole("button", { name: "Retirer l’annonce du site" })
    .click();
  await report.waitFor({ state: "detached" });
  await page.getByRole("button", { name: "Traités (1)", exact: true }).click();
  await page.getByText("Annonce retirée du site.", { exact: false }).waitFor();
  await page.screenshot({
    path: "/tmp/offres-signalements-admin.png",
    fullPage: true,
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await nav.getByRole("button", { name: "Repérées", exact: true }).click();
  await page.locator(".external-card").first().waitFor();
  assert.equal(
    await page.locator(`.external-card a[href="${originalUrl}"]`).count(),
    0,
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Débordement à ${width}px`,
    );
  }
  assert.deepEqual(errors, []);
  console.log(
    "Signalement visiteur → gestion authentifiée → retrait durable d’une référence : parcours validé, sans modification du catalogue de production.",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
