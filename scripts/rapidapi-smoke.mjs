import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
const folder = await mkdtemp("/tmp/offres-rapidapi-ui-");
const token = randomBytes(32).toString("hex"),
  key = "test-only-private-key";
let calls = 0;
const app = createApp({
  folder,
  adminToken: token,
  pipelineOptions: { sources: async () => [] },
  rapidApiOptions: {
    env: { RAPIDAPI_LINKEDIN_KEY: key },
    fetcher: async () => {
      calls++;
      return new Response(
        JSON.stringify({
          data: [
            {
              title: "Exemple fictif — test uniquement",
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
      .getByRole("button", { name: "Tester RapidAPI", exact: true })
      .count(),
    0,
  );
  await page.goto(new URL("/administration/", base).href);
  assert.equal(
    await page
      .getByRole("button", { name: "Tester RapidAPI", exact: true })
      .count(),
    0,
  );
  await page.getByLabel("Code d’accès").fill(token);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await page
    .getByRole("button", { name: "Sources & collecte", exact: true })
    .click();
  const button = page.getByRole("button", {
    name: "Tester RapidAPI",
    exact: true,
  });
  await button.waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll("button")].some(
      (b) => b.textContent === "Tester RapidAPI" && !b.disabled,
    ),
  );
  assert.equal(calls, 0);
  await button.click();
  await page
    .locator(".rapidapi-result")
    .getByText(/HTTP 200/)
    .waitFor();
  await page.locator(".rapidapi-result summary").click();
  assert.match(
    await page.locator(".rapidapi-result pre").innerText(),
    /publishedAt/,
  );
  const text = await page.locator("body").innerText();
  assert.ok(!text.includes(key));
  assert.ok(!text.includes("private@example.org"));
  assert.ok(!text.includes("Exemple fictif — test uniquement"));
  assert.equal(calls, 1);
  assert.equal((await app.locals.store.read()).length, 0);
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
    "RapidAPI privé : bouton utilisable sans Shell, un seul appel, structure sans valeurs privées, aucune publication, aucun contrôle public, mobile/PC validés.",
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  app.locals.store.close();
  await rm(folder, { recursive: true, force: true });
}
