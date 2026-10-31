import puppeteer from "puppeteer-core";
import { homedir } from "node:os";
import { join } from "node:path";

const brave = "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe";
const extensionPath = join(process.cwd(), "dist-extension");
const userDataDir = join(homedir(), "AppData", "Local", "Temp", "sello-brave-test");

const browser = await puppeteer.launch({
  executablePath: brave,
  headless: false,
  pipe: true,
  defaultViewport: null,
  enableExtensions: [extensionPath],
  userDataDir,
  args: ["--enable-unsafe-extension-debugging"],
});

const id = await browser.installExtension(extensionPath).catch((error) => {
  console.error("installExtension", error.message);
  return "";
});
console.log("extensionId", id);

const page = (await browser.pages())[0] || (await browser.newPage());
await page.goto("https://mail.google.com/mail/u/0/#inbox", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await new Promise((resolve) => setTimeout(resolve, 4000));

const before = await page.evaluate(() => ({
  url: location.href,
  host: Boolean(document.getElementById("sello-extension-host")),
  title: document.title,
}));
console.log("before", JSON.stringify(before));

const injected = await page.evaluate(() => {
  if (!location.hostname.includes("mail.google.com")) return false;
  const root = document.createElement("div");
  root.className = "nH if";
  root.setAttribute("role", "main");
  const heading = document.createElement("h2");
  heading.className = "hP";
  heading.textContent = "Urgente: verifica tu cuenta PayPal";
  const message = document.createElement("div");
  message.setAttribute("data-message-id", "sello-test-1");
  message.className = "adn ads";
  const from = document.createElement("span");
  from.className = "gD";
  from.setAttribute("email", "soporte@paypa1-secure.com");
  from.setAttribute("name", "PayPal");
  from.textContent = "PayPal";
  const to = document.createElement("span");
  to.className = "g2";
  to.setAttribute("email", "me@gmail.com");
  to.textContent = "yo";
  const wrap = document.createElement("div");
  wrap.className = "ii gt";
  const body = document.createElement("div");
  body.className = "a3s aiL";
  body.textContent = "Hola, confirma tu identidad aqui: https://paypa1-secure.com/login";
  wrap.append(body);
  message.append(from, to, wrap);
  root.append(heading, message);
  document.body.append(root);
  history.replaceState(null, "", "/mail/u/0/#inbox/FMfctestSello");
  return true;
});

await new Promise((resolve) => setTimeout(resolve, 1500));

const result = await page.evaluate(() => {
  const host = document.getElementById("sello-extension-host");
  const shadow = host?.shadowRoot;
  return {
    url: location.href,
    title: document.title,
    injected: true,
    host: Boolean(host),
    hasShadow: Boolean(shadow),
    text: shadow?.textContent?.replace(/\s+/g, " ").trim().slice(0, 600) || "",
    score: shadow?.querySelector(".stamp span")?.textContent || "",
  };
});

console.log(JSON.stringify({ ...result, extensionId: id, injected }, null, 2));
await browser.close();
process.exit(result.host ? 0 : 3);
