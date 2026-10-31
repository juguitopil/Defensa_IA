import puppeteer from "puppeteer-core";

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9334", defaultViewport: null });
const pages = await browser.pages();
let page = pages.find((item) => item.url().includes("mail.google.com") || item.url().includes("accounts.google.com")) || pages[0];
if (!page) {
  page = await browser.newPage();
}

await page.bringToFront();
await page.goto("https://mail.google.com/mail/u/0/#inbox", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => !location.href.includes("accounts.google.com") || document.body.innerText.length > 20, { timeout: 20000 }).catch(() => {});
await new Promise((resolve) => setTimeout(resolve, 4000));

const state = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  login: location.href.includes("accounts.google.com"),
  host: Boolean(document.getElementById("sello-extension-host")),
}));

if (state.login) {
  console.log(JSON.stringify({ ok: false, reason: "login", ...state }));
  process.exit(2);
}

const row = await page.$("tr.zA, div[role='main'] tr.zA, [role='listitem']");
if (row) {
  await row.click();
  await new Promise((resolve) => setTimeout(resolve, 2500));
}

const result = await page.evaluate(() => {
  const host = document.getElementById("sello-extension-host");
  const shadow = host?.shadowRoot;
  const text = shadow?.textContent?.replace(/\s+/g, " ").trim().slice(0, 500) || "";
  return {
    url: location.href,
    title: document.title,
    host: Boolean(host),
    hasShadow: Boolean(shadow),
    text,
    score: shadow?.querySelector(".stamp span")?.textContent || "",
    heading: shadow?.querySelector("h2")?.textContent || "",
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.disconnect();
process.exit(result.host ? 0 : 3);
