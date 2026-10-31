import { execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const extensionPath = join(process.cwd(), "dist-extension");
const chromeCandidates = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
].filter(Boolean);
const chrome = chromeCandidates.find((path) => existsSync(path));
if (!chrome) throw new Error("No encontré Chrome");

const fixture = `<!doctype html>
<html lang="es"><body>
  <div role="main" class="nH if">
    <h2 class="hP">Pago urgente de PayPal</h2>
    <span class="gD" email="aviso@paypa1-secure.com" name="PayPal">PayPal</span>
    <span class="g2" email="yo@sello.mail">yo</span>
    <div class="ii gt"><div class="a3s aiL">
      Confirma tu cuenta ahora:
      <a href="http://192.168.8.20/paypal">https://www.paypal.com/login</a>
    </div></div>
  </div>
</body></html>`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDebug(port, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (response.ok) return await response.json();
    } catch {}
    await wait(500);
  }
  throw new Error(`Chrome no abrió el puerto ${port}`);
}

function startChrome(args) {
  const child = spawn(chrome, args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function readPanel(page) {
  return page.evaluate(() => {
    const host = document.getElementById("sello-extension-host");
    const shadow = host?.shadowRoot;
    return {
      host: Boolean(host),
      hasShadow: Boolean(shadow),
      score: shadow?.querySelector(".stamp span")?.textContent || "",
      heading: shadow?.querySelector("h2")?.textContent || "",
      text: shadow?.textContent?.replace(/\s+/g, " ").trim().slice(0, 400) || "",
      url: location.href,
      title: document.title,
    };
  });
}

const fixtureServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(fixture);
});
await new Promise((resolve) => fixtureServer.listen(4179, "127.0.0.1", resolve));

const isolatedDir = join(homedir(), "AppData", "Local", "Temp", "sello-chrome-isolated");
startChrome([
  `--user-data-dir=${isolatedDir}`,
  `--load-extension=${extensionPath}`,
  `--disable-extensions-except=${extensionPath}`,
  "--remote-debugging-port=9335",
  "--no-first-run",
  "--no-default-browser-check",
  "http://127.0.0.1:4179/",
]);

let isolated = { ok: false, reason: "no-connect" };
try {
  await waitForDebug(9335);
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9335", defaultViewport: null });
  const page = (await browser.pages())[0] || (await browser.newPage());
  await page.goto("http://127.0.0.1:4179/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.addScriptTag({ path: join(extensionPath, "content.js") });
  await wait(800);
  isolated = { ok: true, ...(await readPanel(page)) };
  await page.screenshot({ path: join(process.cwd(), ".tmp-sello-fixture.png"), fullPage: true });
  await browser.disconnect();
} catch (error) {
  isolated = { ok: false, reason: String(error?.message || error) };
}

const userDataDir = join(homedir(), "AppData", "Local", "Google", "Chrome", "User Data");
try {
  execSync("taskkill /IM chrome.exe /F", { stdio: "ignore" });
} catch {}
await wait(3000);
startChrome([
  `--user-data-dir=${userDataDir}`,
  "--profile-directory=Default",
  `--load-extension=${extensionPath}`,
  "--enable-unsafe-extension-debugging",
  "--remote-debugging-port=9334",
  "--restore-last-session",
  "--no-first-run",
  "--no-default-browser-check",
]);

let gmail = { ok: false, reason: "no-connect" };
try {
  await waitForDebug(9334, 50);
  const browser = await puppeteer.connect({ browserURL: "http://127.0.0.1:9334", defaultViewport: null });
  const pages = await browser.pages();
  const page =
    pages.find((item) => item.url().includes("mail.google.com")) || pages[0] || (await browser.newPage());
  await page.bringToFront();
  await page.goto("https://mail.google.com/mail/u/0/#inbox", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await wait(5000);
  const login = page.url().includes("accounts.google.com");
  if (!login) {
    const row = await page.$("tr.zA, [role='main'] tr.zA, [role='listitem']");
    if (row) {
      await row.click();
      await wait(3000);
    }
  }
  let panel = await readPanel(page);
  if (!panel.host && !login) {
    await page.addScriptTag({ path: join(extensionPath, "content.js") });
    await wait(1200);
    panel = await readPanel(page);
    panel.injected = true;
  }
  gmail = { ok: true, login, ...panel };
  await page.screenshot({ path: join(process.cwd(), ".tmp-sello-gmail.png") }).catch(() => {});
  await browser.disconnect();
} catch (error) {
  gmail = { ok: false, reason: String(error?.message || error) };
}

fixtureServer.close();
console.log(JSON.stringify({ isolated, gmail }, null, 2));
const panelOk = isolated.host && gmail.host && !gmail.login;
process.exit(panelOk ? 0 : 3);
