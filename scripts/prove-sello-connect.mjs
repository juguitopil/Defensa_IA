import { join } from "node:path";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9334", defaultViewport: null });
const pages = await browser.pages();
const page =
  pages.find((item) => item.url().includes("mail.google.com") || item.url().includes("accounts.google.com")) ||
  pages[0] ||
  (await browser.newPage());
await page.bringToFront();
if (!page.url().includes("mail.google.com") && !page.url().includes("accounts.google.com")) {
  await page.goto("https://mail.google.com/mail/u/0/#inbox", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
}
await new Promise((resolve) => setTimeout(resolve, 6000));

const login = page.url().includes("accounts.google.com");
if (!login) {
  const row = await page.$("tr.zA");
  if (row) {
    await row.click();
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

async function panel() {
  return page.evaluate(() => {
    const host = document.getElementById("sello-extension-host");
    const shadow = host?.shadowRoot;
    return {
      host: Boolean(host),
      score: shadow?.querySelector(".stamp span")?.textContent || "",
      heading: shadow?.querySelector("h2")?.textContent || "",
      empty: Boolean(shadow?.querySelector(".empty")),
      text: [...(shadow?.querySelectorAll("h2, .score p, .empty p") || [])]
        .map((el) => el.textContent.trim())
        .join(" | ")
        .slice(0, 280),
      url: location.href,
      title: document.title,
    };
  });
}

let result = await panel();
if (!result.host && !login) {
  await page.addScriptTag({ path: join(process.cwd(), "dist-extension/content.js") });
  await new Promise((resolve) => setTimeout(resolve, 1500));
  result = { ...(await panel()), injected: true };
}

await page.screenshot({ path: join(process.cwd(), ".tmp-sello-gmail.png") });
console.log(JSON.stringify({ login, ...result }, null, 2));
await browser.disconnect();
process.exit(result.host && !login ? 0 : 3);
