import puppeteer from "puppeteer-core";
import { homedir } from "node:os";
import { join } from "node:path";

const chrome = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const userDataDir = join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
const extensionPath = join(process.cwd(), "dist-extension");

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [extensionPath],
  userDataDir,
  timeout: 45000,
  waitForInitialPage: false,
  args: ["--profile-directory=Default", "--enable-unsafe-extension-debugging"],
});

console.log("launched");
const id = await browser.installExtension(extensionPath).catch((error) => {
  console.error("installExtension", error.message);
  return "";
});
console.log("extensionId", id);

const page = await browser.newPage();
await page.goto("https://mail.google.com/mail/u/0/#inbox", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await new Promise((resolve) => setTimeout(resolve, 5000));

const state = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  login:
    location.href.includes("accounts.google.com") ||
    location.href.includes("workspace.google.com"),
  host: Boolean(document.getElementById("sello-extension-host")),
}));
console.log("state", JSON.stringify(state));

if (!state.login) {
  const row = await page.$("tr.zA");
  if (row) await row.click();
  await new Promise((resolve) => setTimeout(resolve, 3000));
}

const result = await page.evaluate(() => {
  const host = document.getElementById("sello-extension-host");
  const shadow = host?.shadowRoot;
  return {
    url: location.href,
    title: document.title,
    host: Boolean(host),
    hasShadow: Boolean(shadow),
    text: shadow?.textContent?.replace(/\s+/g, " ").trim().slice(0, 700) || "",
    score: shadow?.querySelector(".stamp span")?.textContent || "",
  };
});

console.log(JSON.stringify({ ...result, extensionId: id }, null, 2));
await browser.disconnect();
process.exit(result.host ? 0 : 3);
