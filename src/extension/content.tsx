import { createRoot, type Root } from "react-dom/client";
import type { Mail, SecurityReport } from "../types";
import { ExtensionPanel } from "./panel";
import css from "./panel.css?inline";
import { inspectDocument } from "./run";

const boot = window as Window & { __selloBooted?: boolean };

function placeHost(host: HTMLDivElement, collapsed = false) {
  host.id = "sello-extension-host";
  host.setAttribute(
    "style",
    [
      "all:initial",
      "position:fixed",
      collapsed ? "top:28%" : "top:0",
      "right:0",
      collapsed ? "width:5.75rem" : "width:22rem",
      collapsed ? "height:auto" : "height:100vh",
      "z-index:2147483647",
      "pointer-events:none",
      "display:block",
    ].join("!important;") + "!important",
  );
  const parent = document.documentElement || document.body;
  if (host.parentElement !== parent) parent.appendChild(host);
}

function ensureHost(): { root: Root; wrap: HTMLDivElement } {
  const existing = document.getElementById("sello-extension-host") as HTMLDivElement | null;
  if (existing?.shadowRoot) {
    const mount = existing.shadowRoot.querySelector(".sello-root");
    if (mount && (existing as HTMLDivElement & { __selloRoot?: Root }).__selloRoot) {
      placeHost(existing, !open);
      return { root: (existing as HTMLDivElement & { __selloRoot: Root }).__selloRoot, wrap: existing };
    }
  }
  const host = existing ?? document.createElement("div");
  placeHost(host, !open);
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadow.innerHTML = "";
  const style = document.createElement("style");
  style.textContent = css;
  const mount = document.createElement("div");
  mount.className = "sello-root";
  shadow.append(style, mount);
  const root = createRoot(mount);
  (host as HTMLDivElement & { __selloRoot: Root }).__selloRoot = root;
  return { root, wrap: host };
}

let open = true;
let mail: Mail | null = null;
let report: SecurityReport | null = null;
let lastId = "";
let timer = 0;

function dock(active: boolean) {
  document.documentElement.classList.toggle("sello-docked", active);
  document.documentElement.style.setProperty("--sello-dock", active ? "22rem" : "0px");
  let style = document.getElementById("sello-dock-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "sello-dock-style";
    document.documentElement.appendChild(style);
  }
  style.textContent = active
    ? `
      html.sello-docked h2.hP,
      html.sello-docked .nH.if,
      html.sello-docked .iY,
      html.sello-docked .aeJ .nH.if {
        margin-right: 22rem !important;
        max-width: none !important;
      }
    `
    : "";
}

function paint() {
  try {
    dock(open && Boolean(mail));
    const { root } = ensureHost();
    root.render(
      <ExtensionPanel
        open={open}
        mail={mail}
        report={report}
        onToggle={() => {
          open = !open;
          paint();
        }}
      />,
    );
  } catch (error) {
    console.error("Sello no pudo pintar el panel", error);
  }
}

async function refresh() {
  const next = await inspectDocument(document);
  if (!next) {
    if (lastId) {
      lastId = "";
      mail = null;
      report = null;
      paint();
    } else {
      paint();
    }
    return;
  }
  if (next.mail.id === lastId) return;
  lastId = next.mail.id;
  mail = next.mail;
  report = next.report;
  paint();
}

function schedule() {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void refresh();
  }, 280);
}

if (!boot.__selloBooted) {
  boot.__selloBooted = true;
  paint();
  void refresh();
  window.addEventListener("hashchange", () => {
    lastId = "";
    schedule();
  });
  window.addEventListener("popstate", () => {
    lastId = "";
    schedule();
  });
  const observer = new MutationObserver(schedule);
  function watch() {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", watch, { once: true });
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
  }
  watch();
} else {
  paint();
  void refresh();
}
