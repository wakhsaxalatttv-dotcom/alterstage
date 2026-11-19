import assert from "node:assert/strict";
import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { createApp } from "../server/app.js";
import {
  candidateProvider,
  fixturePassword,
} from "../test/helpers/candidate-provider.js";
let failSignup = false;
const provider = await candidateProvider(),
  folder = await mkdtemp("/tmp/of-accounts-ui-"),
  app = createApp({
    folder,
    adminToken: "fixture-browser-admin-token-only".repeat(2),
    pipelineOptions: { sources: async () => [] },
    candidateOptions: {
      enabled: true,
      secureCookies: false,
      fetcher: (url, options) =>
        failSignup && new URL(url).pathname === "/auth/v1/signup"
          ? Promise.resolve(
              new Response(
                JSON.stringify({
                  code: "unexpected_failure",
                  msg: "Error sending confirmation email: private-detail-do-not-expose",
                }),
                {
                  status: 500,
                  headers: { "Content-Type": "application/json" },
                },
              ),
            )
          : provider.fetcher(url, options),
      onFailure: () => {},
      env: {},
    },
  }),
  server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
const base = "http://127.0.0.1:" + server.address().port;
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(12000);
  await page.goto(base + "/compte");
  await page.getByRole("tab", { name: "Créer un compte", exact: true }).click();
  await page.getByLabel("Prénom", { exact: true }).fill("Camille");
  await page.getByLabel("Nom", { exact: true }).fill("Test");
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("camille@example.org");
  await page
    .getByLabel("Mot de passe — 12 caractères minimum", { exact: true })
    .fill(fixturePassword);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Si cette adresse" })
    .waitFor();
  const user = provider.users.get("camille@example.org");
  assert.ok(user);
  assert.equal(user.email_confirmed_at, null);
  // A local confirmation link, not a real email or external account.
  await page.goto(base + "/compte#token_hash=" + user.id + "&type=email");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page
    .getByRole("tab", { name: "Mes candidatures", exact: true })
    .waitFor();
  assert.equal(new URL(page.url()).hash, "");
  const cookies = await page.context().cookies();
  assert.ok(
    cookies.filter((c) => c.name.startsWith("of_")).every((c) => c.httpOnly),
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("supabase.auth.token")),
    null,
  );
  // Publish a fictitious offer only into this disposable local catalogue.
  const adminHeaders = {
    "Content-Type": "application/json",
    Authorization: "Bearer " + "fixture-browser-admin-token-only".repeat(2),
  };
  const submitted = await fetch(base + "/api/admin/import", {
    method: "POST",
    headers: adminHeaders,
    body: JSON.stringify({
      title: "Stage fictif — suivi candidat",
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
      expiresAt: new Date(Date.now() + 10 * 86400000)
        .toISOString()
        .slice(0, 10),
      consent: true,
    }),
  });
  assert.equal(submitted.status, 201);
  const { id } = await submitted.json();
  const approved = await fetch(
    base + "/api/admin/submissions/" + id + "/review",
    {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        action: "approve",
        sourceChecked: true,
        rightsChecked: true,
        companyChecked: true,
        contactChecked: true,
      }),
    },
  );
  assert.equal(approved.status, 200);
  await page.context().route("https://example.org/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<html lang='fr'><body>Page employeur fictive réservée au test local</body></html>",
    }),
  );
  const meResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/account/me",
  );
  await page.goto(base + "/");
  await meResponse;
  const card = page
    .locator(".offer-card")
    .filter({ hasText: "Stage fictif — suivi candidat" });
  await card.waitFor();
  const clickResponse = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/account/click",
  );
  const popupPromise = page.waitForEvent("popup");
  await card
    .getByRole("link", { name: "Candidater", exact: true })
    .first()
    .click();
  const popup = await popupPromise;
  assert.equal((await clickResponse).status(), 200);
  await popup.close();
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page
    .getByRole("complementary", { name: "Confirmation de candidature" })
    .waitFor();
  await page
    .getByRole("button", { name: "Oui, j’ai postulé", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Mon compte", exact: true }).click();
  await page
    .getByText("Candidature envoyée", { exact: true })
    .first()
    .waitFor();
  await page
    .getByLabel("Avancement", { exact: true })
    .selectOption("interview");
  await page
    .getByLabel("Notes personnelles", { exact: true })
    .fill("Entretien de test vendredi");
  await page
    .getByRole("button", { name: "Enregistrer le suivi", exact: true })
    .click();
  await page.getByText("Entretien", { exact: true }).first().waitFor();
  await page.screenshot({
    path: "/tmp/offres-accounts-desktop.png",
    fullPage: true,
  });
  for (const width of [360, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      "No horizontal overflow at " + width,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Mon compte", exact: true })
        .isVisible(),
      true,
    );
  }
  await page.getByRole("tab", { name: "Mes alertes", exact: true }).click();
  await page
    .getByLabel("Nom de la recherche", { exact: true })
    .fill("Stages de test");
  await page.getByLabel("Mots-clés", { exact: true }).fill("banque");
  await page
    .getByRole("button", { name: "Enregistrer la recherche", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Stages de test", exact: true })
    .waitFor();
  await page.getByRole("tab", { name: "Mon profil", exact: true }).click();
  await page.getByLabel("Prénom", { exact: true }).fill("Camille2");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByText("Bonjour Camille2", { exact: true }).waitFor();
  await page.screenshot({
    path: "/tmp/offres-accounts-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.getByRole("tab", { name: "Se connecter", exact: true }).waitFor();
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("camille@example.org");
  await page.getByLabel("Mot de passe", { exact: true }).fill(fixturePassword);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByText("Bonjour Camille2", { exact: true }).waitFor();
  // Reuse the same tab to check a recovery callback after the first confirmation.
  await page.goto(base + "/compte#token_hash=" + user.id + "&type=recovery");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();
  await page
    .getByRole("heading", {
      name: "Choisir un nouveau mot de passe",
      exact: true,
    })
    .waitFor();
  await page
    .getByLabel("Nouveau mot de passe — 12 caractères minimum", { exact: true })
    .fill("New-fixture-password-only-2026");
  await page
    .getByRole("button", { name: "Modifier le mot de passe", exact: true })
    .click();
  await page.getByRole("tab", { name: "Se connecter", exact: true }).waitFor();
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("camille@example.org");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("New-fixture-password-only-2026");
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page.getByText("Bonjour Camille2", { exact: true }).waitFor();
  // A provider-side mail failure must not appear as a successful registration.
  await page
    .getByRole("button", { name: "Se déconnecter", exact: true })
    .click();
  await page.getByRole("tab", { name: "Créer un compte", exact: true }).click();
  await page.getByLabel("Prénom", { exact: true }).fill("Alex");
  await page.getByLabel("Nom", { exact: true }).fill("Test");
  await page
    .getByLabel("Adresse e-mail", { exact: true })
    .fill("alex@example.org");
  await page
    .getByLabel("Mot de passe — 12 caractères minimum", { exact: true })
    .fill(fixturePassword);
  await page.getByRole("checkbox").check();
  failSignup = true;
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "n’a pas pu être envoyé" })
    .waitFor();
  assert.doesNotMatch(
    await page.locator(".candidate-panel").innerText(),
    /Si cette adresse|private-detail/,
  );
  await page.goto(base + "/administration/");
  await page
    .getByLabel("Code d’accès", { exact: true })
    .fill("fixture-browser-admin-token-only".repeat(2));
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("button", { name: "Audience & comptes", exact: true })
    .click();
  const diagnostic = page.getByRole("region", {
    name: "Diagnostic des comptes",
  });
  await diagnostic.getByText(/Supabase n’a pas pu envoyer l’e-mail/).waitFor();
  assert.doesNotMatch(
    await diagnostic.innerText(),
    /private-detail|alex@example/,
  );
  await page.screenshot({
    path: "/tmp/offres-account-diagnostic.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Comptes : inscription, confirmation simulée, cookies HttpOnly, suivi persistant, alertes, profil, récupération du mot de passe, reconnexion, échec SMTP simulé et diagnostic privé, affichage 360/390/768/1440 px vérifiés en local.",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  app.locals.store.close();
  await provider.close();
  await rm(folder, { recursive: true, force: true });
}
