import { createRoot, type Root } from "react-dom/client";
import type { Mail, SecurityReport } from "../types";
import { ExtensionPanel } from "./panel";
import css from "./panel.css?inline";
import { inspectDocument } from "./run";

const boot = window as Window & { __selloBooted?: boolean };
const DEFAULT_WIDTH = 352;
const MIN_WIDTH = 280;
const MAX_WIDTH = 520;
const WIDTH_KEY = "sello.panelWidth";

function clampWidth(px: number): number {
  const ceiling = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(window.innerWidth * 0.45)));
  return Math.round(Math.min(ceiling, Math.max(MIN_WIDTH, px)));
}

function readWidth(): number {
  try {
    const raw = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(raw) && raw > 0) return clampWidth(raw);
  } catch {
    /* el navegador puede bloquear el almacenamiento */
  }
  return DEFAULT_WIDTH;
}

let panelWidth = readWidth();

function placeHost(host: HTMLDivElement, collapsed = false) {
  host.id = "sello-extension-host";
  host.setAttribute(
    "style",
    [
      "all:initial",
      "position:fixed",
      collapsed ? "top:28%" : "top:0",
      "right:0",
      collapsed ? "width:5.75rem" : `width:${panelWidth}px`,
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

function mailColumn(): HTMLElement | null {
  const columns = [...document.querySelectorAll<HTMLElement>('div.nH[role="main"]')];
  return (
    columns.find((el) => {
      const box = el.getBoundingClientRect();
      return box.width > 200 && box.height > 200;
    }) ??
    columns[0] ??
    null
  );
}

function dock(active: boolean, reflow = false) {
  const size = `${panelWidth}px`;
  document.documentElement.classList.toggle("sello-docked", active);
  document.documentElement.style.setProperty("--sello-dock", active ? size : "0px");
  let style = document.getElementById("sello-dock-style");
  if (!style) {
    style = document.createElement("style");
    style.id = "sello-dock-style";
    document.documentElement.appendChild(style);
  }
  // Solo el margen, en un contenedor. El ancho interno lo sigue manejando Gmail, así la barra divisora se puede arrastrar.
  style.textContent = `
    html.sello-docked div.nH[role="main"].sello-main-inset {
      box-sizing: border-box !important;
      margin-right: ${size} !important;
    }
    html.sello-docked div.nH[role="main"].sello-main-inset.sello-main-abs {
      right: ${size} !important;
      margin-right: 0 !important;
    }
    html.sello-dragging, html.sello-dragging * {
      cursor: col-resize !important;
      user-select: none !important;
    }
  `;

  const column = mailColumn();
  for (const node of document.querySelectorAll<HTMLElement>(".sello-main-inset")) {
    if (node !== column) node.classList.remove("sello-main-inset", "sello-main-abs");
  }
  if (!column) return;

  const wasInset = column.classList.contains("sello-main-inset");
  column.classList.toggle("sello-main-inset", active);
  if (!active) {
    column.classList.remove("sello-main-abs");
    return;
  }
  const position = getComputedStyle(column).position;
  column.classList.toggle("sello-main-abs", position === "absolute" || position === "fixed");
  if (active && (reflow || !wasInset)) window.dispatchEvent(new Event("resize"));
}

function syncFrame(reflow = false) {
  dock(open, reflow);
  const host = document.getElementById("sello-extension-host");
  if (!host || !open) return;
  host.style.setProperty("width", `${panelWidth}px`, "important");
}

function setPanelWidth(px: number, persist = false) {
  const next = clampWidth(px);
  const changed = next !== panelWidth;
  panelWidth = next;
  if (persist) {
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      /* el ancho se aplica igual en esta visita */
    }
  }
  if (!changed && !persist) return;
  if (!persist) {
    syncFrame(false);
    return;
  }
  paint(true);
}

function paint(reflow = false) {
  try {
    dock(open, reflow);
    const { root } = ensureHost();
    root.render(
      <ExtensionPanel
        open={open}
        width={panelWidth}
        mail={mail}
        report={report}
        onResize={setPanelWidth}
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
  window.addEventListener("resize", (event) => {
    if (!event.isTrusted) return;
    const next = clampWidth(panelWidth);
    if (next === panelWidth) return;
    panelWidth = next;
    paint();
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
