import puppeteer from "puppeteer-core";
import { homedir } from "node:os";
import { join } from "node:path";

const chrome =
  process.env.CHROME_PATH ||
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
const extensionPath = join(process.cwd(), "dist-extension");

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [extensionPath],
  userDataDir,
  args: [
    "--profile-directory=Default",
    "--enable-unsafe-extension-debugging",
    "--restore-last-session",
  ],
});

const id = await browser.installExtension(extensionPath).catch((error) => {
  console.error("installExtension", error.message);
  return "";
});
console.log("extensionId", id);

const pages = await browser.pages();
const page = pages[0] || (await browser.newPage());
await page.bringToFront();
await page.goto("https://mail.google.com/mail/u/0/#inbox", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await new Promise((resolve) => setTimeout(resolve, 5000));

const state = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  login: location.href.includes("accounts.google.com") || location.href.includes("workspace.google.com"),
}));

if (state.login) {
  console.log(JSON.stringify({ ok: false, reason: "login", ...state, extensionId: id }));
  await browser.disconnect();
  process.exit(2);
}

const row = await page.$("tr.zA, div[role='main'] tr.zA");
if (row) await row.click();
await new Promise((resolve) => setTimeout(resolve, 3000));

const result = await page.evaluate(() => {
  const host = document.getElementById("sello-extension-host");
  const shadow = host?.shadowRoot;
  return {
    url: location.href,
    title: document.title,
    host: Boolean(host),
    hasShadow: Boolean(shadow),
    text: shadow?.textContent?.replace(/\s+/g, " ").trim().slice(0, 600) || "",
    score: shadow?.querySelector(".stamp span")?.textContent || "",
    heading: shadow?.querySelector("h2")?.textContent || "",
  };
});

console.log(JSON.stringify({ ...result, extensionId: id }, null, 2));
await browser.disconnect();
process.exit(result.host ? 0 : 3);
