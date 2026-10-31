import { chromium } from "playwright";
import { previewServer } from "../scripts/serve.mjs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../..");
const folder = resolve(root, "docs/frontend/screenshots");
await mkdir(folder, { recursive: true });
const server = previewServer();
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const manifest = JSON.parse(
  await readFile(resolve(root, "dist/imd-deployment.json"), "utf8"),
);
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-unsafe-swiftshader"],
});
const views = [];
const errors = [];
try {
  for (const width of [320, 390, 800, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    if (process.argv[2])
      for (const rpc of manifest.network.rpcUrls)
        await context.route(rpc, async (route) => {
          const result = await fetch(process.argv[2], {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: route.request().postData(),
          });
          await route.fulfill({
            status: result.status,
            contentType: "application/json",
            body: await result.text(),
          });
        });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (response) => {
      if (response.url().startsWith(url) && response.status() >= 400)
        errors.push(
          `Local resource ${response.status()}: ${new URL(response.url()).pathname}`,
        );
    });
    await page.goto(url);
    await page.waitForFunction(() =>
      /\d{4}/.test(document.querySelector(".epoch-row")?.textContent ?? ""),
    );
    await page.waitForFunction(() =>
      document.querySelector(".map-canvas canvas"),
    );
    await page
      .waitForFunction(
        () =>
          !document
            .querySelector(".map-message")
            ?.textContent?.includes("Loading"),
        {},
        { timeout: 20000 },
      )
      .catch(() => {});
    const vote = await page.locator(".vote-action").boundingBox();
    assert(vote.y + vote.height < 900, "Main action is on first screen");
    const view = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      voteBottom: document.querySelector(".vote-action").getBoundingClientRect()
        .bottom,
      heading: getComputedStyle(document.querySelector("h1")).fontSize,
      epoch: document.querySelector(".epoch-row").textContent,
      tiles: !document.querySelector(".map-message"),
      wheel: document.querySelector(".stats-strip>div")?.textContent,
    }));
    assert(view.scrollWidth <= width, `${width}px overflow`);
    views.push(view);
    if (width === 390 || width === 1440)
      await page.screenshot({
        path: resolve(folder, `${width}-live.webp`),
        type: "webp",
        quality: 82,
        fullPage: true,
      });
    if (width === 390) {
      await page
        .getByRole("button", { name: "Connect wallet", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "visible" });
      await page.keyboard.press("Tab");
      assert(
        await page.evaluate(() =>
          document.querySelector("dialog").contains(document.activeElement),
        ),
        "Dialog traps focus",
      );
      await page.screenshot({
        path: resolve(folder, "390-wallet.webp"),
        type: "webp",
        quality: 82,
      });
      await page.keyboard.press("Escape");
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page
        .getByRole("button", { name: "Pause animation", exact: true })
        .click();
      await page.waitForFunction(
        () => document.documentElement.dataset.motion === "paused",
      );
      assert.equal(
        await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) => a instanceof CSSAnimation && a.playState === "running",
              ).length,
        ),
        0,
        "Pause stops every hamster animation",
      );
      await page
        .getByRole("button", { name: "Resume animation", exact: true })
        .click();
      await page.waitForFunction(
        () => document.documentElement.dataset.motion === "playing",
      );
      assert(
        (await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter(
                (a) => a instanceof CSSAnimation && a.playState === "running",
              ).length,
        )) > 0,
        "Resume restores animation",
      );
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page.evaluate(
          () =>
            document.getAnimations().filter((a) => a.playState === "running")
              .length,
        ),
        0,
      );
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "200% text resize reflows",
      );
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await writeFile(
    resolve(root, "docs/frontend/visual-checks.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        exportPath: "/preview/",
        views,
        scriptAndLocalResourceErrors: errors,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(
  "Live screenshots, first screen, four widths, dialog focus, pause/resume and 200% text enlargement checked.",
);
