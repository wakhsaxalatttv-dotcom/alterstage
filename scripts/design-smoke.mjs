import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { normalizeSubmission } from "../server/domain.js";
const folder = await mkdtemp("/tmp/offres-design-");
const app = createApp({
  folder,
  adminToken: "",
  pipelineOptions: { sources: async () => [] },
});
for (const [index, name] of [
  "Logo source",
  "Icône officielle",
  "Monogramme repli",
].entries()) {
  const offer = normalizeSubmission({
    title: `Exemple fictif — ${name}`,
    companyName: name,
    companyWebsite: `https://company-${index}.example.org`,
    companyLogoUrl: `https://assets.example.org/logo-${index}.svg`,
    logoConsent: true,
    sourceUrl: `https://example.org/jobs/${index}`,
    contract: "Stage",
    city: "Paris",
    region: "Île-de-France",
    domain: "Développement logiciel & web",
    education: "Bac + 3",
    description:
      "Exemple fictif de validation visuelle, jamais ajouté au catalogue réel.",
    publishedAt: new Date().toISOString().slice(0, 10),
    expiresAt: new Date(Date.now() + 10 * 864e5).toISOString().slice(0, 10),
    consent: true,
  });
  await app.locals.store.submit({
    ...offer,
    moderationStatus: "approved",
    workMode: index === 0 ? "hybrid" : undefined,
  });
}
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  headless: true,
  args: ["--no-sandbox"],
});
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" fill="#1e293b"/></svg>';
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  page.setDefaultTimeout(10000);
  let delay = true;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (delay && url.pathname === "/api/offers") {
      delay = false;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.fulfill({
      response: await route.fetch({ url: base + url.pathname + url.search }),
    });
  });
  await page.route("https://assets.example.org/**", (route) =>
    route.request().url().endsWith("logo-0.svg")
      ? route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg })
      : route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "Not found",
        }),
  );
  await page.route("https://www.google.com/s2/favicons?**", (route) =>
    decodeURIComponent(route.request().url()).includes("company-1.example.org")
      ? route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg })
      : route.fulfill({
          status: 404,
          contentType: "text/plain",
          body: "Not found",
        }),
  );
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  await page.locator(".skeleton-card").first().waitFor();
  assert.equal(await page.locator(".skeleton-card").count(), 3);
  await page.locator(".offer-card").first().waitFor();
  const source = page
      .locator(".offer-card")
      .filter({ hasText: "Exemple fictif — Logo source" }),
    favicon = page
      .locator(".offer-card")
      .filter({ hasText: "Exemple fictif — Icône officielle" }),
    fallback = page
      .locator(".offer-card")
      .filter({ hasText: "Exemple fictif — Monogramme repli" });
  await source.scrollIntoViewIfNeeded();
  await source
    .getByRole("img", { name: "Logo de Logo source", exact: true })
    .waitFor();
  await favicon.scrollIntoViewIfNeeded();
  await favicon
    .getByRole("img", {
      name: "Icône du site officiel de Icône officielle",
      exact: true,
    })
    .waitFor();
  await fallback.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".offer-card .company-logo img").length === 2,
  );
  assert.equal(
    await fallback.locator(".company-logo svg text").textContent(),
    "MR",
  );
  assert.equal(await favicon.locator(".work-mode").count(), 0);
  assert.equal(await fallback.locator(".verified-badge").count(), 0);
  assert.equal(
    await source
      .locator(".company-logo")
      .evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    48,
  );
  await source.locator("h3 button").click();
  await page.locator("dialog[open]").waitFor();
  assert.ok(
    await page.locator("dialog").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return box.left >= 0 && box.right <= innerWidth;
    }),
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await source
      .locator("h3 button")
      .evaluate((element) => element === document.activeElement),
    true,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Débordement à ${width}px`,
    );
  }
  await page.waitForFunction(
    () => document.querySelector(".app-logo")?.naturalWidth > 0,
  );
  assert.equal(
    await page.locator(".app-logo").getAttribute("src"),
    "/brand-leaf.svg",
  );
  assert.equal(
    await source.evaluate((el) => el.classList.contains("reveal-visible")),
    true,
  );
  await source.hover();
  await page.waitForFunction(
    (element) => {
      const transform = getComputedStyle(element).transform;
      return transform !== "none" && new DOMMatrixReadOnly(transform).m42 < 0;
    },
    await source.elementHandle(),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await source.evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.equal(
    await page.getByRole("button", { name: "Gestion", exact: true }).count(),
    0,
  );
  console.log(
    "Design : logo source, repli favicon, monogramme SVG, squelette, logo d’application, réduction des animations, fenêtre/focus et responsive validés.",
  );
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
