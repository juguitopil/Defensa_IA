import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const extensionPath = join(process.cwd(), "dist-extension");
const chrome = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].find((path) => existsSync(path));
const userDataDir = join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killChrome() {
  try {
    execSync("taskkill /IM chrome.exe /F", { stdio: "ignore" });
  } catch {}
}

for (let i = 0; i < 8; i++) {
  killChrome();
  await wait(800);
  try {
    execSync('tasklist /FI "IMAGENAME eq chrome.exe"', { stdio: "pipe" }).toString();
    const still = execSync('tasklist /FI "IMAGENAME eq chrome.exe" /FO CSV /NH', { stdio: "pipe" })
      .toString()
      .includes("chrome.exe");
    if (!still) break;
  } catch {
    break;
  }
}
await wait(2500);

const child = spawn(
  chrome,
  [
    `--user-data-dir=${userDataDir}`,
    "--profile-directory=Default",
    `--load-extension=${extensionPath}`,
    "--enable-unsafe-extension-debugging",
    "--remote-debugging-port=9334",
    "--remote-allow-origins=*",
    "--restore-last-session",
    "--no-first-run",
    "--no-default-browser-check",
    "https://mail.google.com/mail/u/0/#inbox",
  ],
  { detached: true, stdio: "ignore" },
);
child.unref();

let ready = false;
for (let i = 0; i < 50; i++) {
  try {
    const response = await fetch("http://127.0.0.1:9334/json/version");
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await wait(400);
}
if (!ready) {
  console.log(JSON.stringify({ ok: false, reason: "debug-port" }));
  process.exit(2);
}

const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9334", defaultViewport: null });
const pages = await browser.pages();
const page =
  pages.find((item) => item.url().includes("mail.google.com") || item.url().includes("accounts.google.com")) ||
  pages[0] ||
  (await browser.newPage());
await page.bringToFront();
if (!page.url().includes("mail.google.com")) {
  await page.goto("https://mail.google.com/mail/u/0/#inbox", { waitUntil: "domcontentloaded", timeout: 60000 });
}
await wait(5000);

const login = page.url().includes("accounts.google.com");
if (!login) {
  const row = await page.$("tr.zA, [role='listitem'], [role='main'] tr");
  if (row) {
    await row.click();
    await wait(2800);
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
        .map((el) => el.textContent)
        .join(" | ")
        .slice(0, 240),
      url: location.href,
      title: document.title,
    };
  });
}

let result = await panel();
if (!result.host && !login) {
  await page.addScriptTag({ path: join(extensionPath, "content.js") });
  await wait(1500);
  result = { ...(await panel()), injected: true };
}

await page.screenshot({ path: join(process.cwd(), ".tmp-sello-gmail.png") }).catch(() => {});
console.log(JSON.stringify({ login, ...result }, null, 2));
await browser.disconnect();
process.exit(result.host && !login ? 0 : 3);
