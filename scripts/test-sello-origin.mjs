import puppeteer from "puppeteer-core";
import { homedir } from "node:os";
import { join } from "node:path";

const brave = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const extensionPath = join(process.cwd(), "dist-extension");
const userDataDir = join(homedir(), "AppData", "Local", "Temp", "sello-origin-test");

const browser = await puppeteer.launch({
  executablePath: brave,
  headless: false,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [extensionPath],
  userDataDir,
  args: ["--enable-unsafe-extension-debugging"],
});

const id = await browser.installExtension(extensionPath);
console.log("extensionId", id);

const page = (await browser.pages())[0] || (await browser.newPage());
await page.setRequestInterception(true);
page.on("request", (request) => {
  if (request.isNavigationRequest() && request.url().includes("mail.google.com")) {
    void request.respond({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><title>Urgente: verifica tu cuenta PayPal - Gmail</title></head>
<body>
<div class="nH if" role="main">
  <h2 class="hP">Urgente: verifica tu cuenta PayPal</h2>
  <div data-message-id="sello-test-1" class="adn ads">
    <span class="gD" email="soporte@paypa1-secure.com" name="PayPal">PayPal</span>
    <span class="g2" email="me@gmail.com">yo</span>
    <span class="g3" title="Fri, 31 Oct 2026 15:00:00">15:00</span>
    <div class="ii gt"><div class="a3s aiL">Hola, confirma tu identidad aqui: https://paypa1-secure.com/login</div></div>
  </div>
</div>
</body></html>`,
    });
    return;
  }
  void request.continue();
});

await page.goto("https://mail.google.com/mail/u/0/#inbox/FMfctestSello", {
  waitUntil: "domcontentloaded",
  timeout: 30000,
});
await new Promise((resolve) => setTimeout(resolve, 2500));

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
    heading: shadow?.querySelector("h2")?.textContent || "",
  };
});

console.log(JSON.stringify({ ...result, extensionId: id }, null, 2));
await browser.close();
process.exit(result.host ? 0 : 3);
