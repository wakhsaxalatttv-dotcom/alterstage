import { chromium } from "playwright";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
const browser = await chromium.launch({
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5173");
  const menu = page.getByRole("navigation", { name: "Navigation principale" });
  for (const width of [
    320, 360, 390, 430, 700, 768, 1024, 1150, 1280, 1440, 1920,
  ]) {
    await page.setViewportSize({ width, height: 900 });
    for (const name of [
      "Entreprises",
      "Les offres",
      "Repérées",
      "Mes favoris",
      "Mes alertes",
    ]) {
      const button = menu.getByRole("button", { name, exact: true });
      assert.ok(await button.isVisible(), `${name} masqué à ${width}px`);
      assert.ok(
        await button.evaluate((el) => {
          const b = el.getBoundingClientRect();
          return (
            b.left >= 0 &&
            b.right <= innerWidth &&
            b.height >= 44 &&
            el.scrollWidth <= el.clientWidth
          );
        }),
        `${name} tronqué ou trop petit à ${width}px`,
      );
      assert.ok(await button.innerText(), `Libellé masqué : ${name}`);
      await button.click();
      assert.equal(await button.getAttribute("aria-current"), "page");
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `Débordement ${name} à ${width}px`,
      );
    }
    await page
      .getByRole("button", { name: "Déposer une annonce", exact: true })
      .first()
      .click();
    await page.locator(".employer-form").waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Formulaire à ${width}px`,
    );
    await menu.getByRole("button", { name: "Les offres", exact: true }).click();
    assert.equal(
      await page
        .locator(".public-site")
        .evaluate((el) => getComputedStyle(el).backgroundColor),
      "rgb(37, 42, 61)",
    );
    if (width <= 700) {
      const filters = page.getByRole("button", { name: /^Filtres/ });
      await filters.click();
      assert.equal(await filters.getAttribute("aria-expanded"), "true");
      assert.ok(await page.locator("#search-filters").isVisible());
      await filters.click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/offres-mobile.png", fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "/tmp/offres-desktop.png" });
  console.log(
    "Responsive : cinq menus nommés et cliquables, sélection, formulaire, filtres et absence de débordement validés de 320 à 1920 px.",
  );
} finally {
  await browser.close();
}
