import { useMemo, useState } from "react";
import { PumpkinMark } from "../components/PumpkinMark";
import { analyzeMail } from "../lib/security/analyze";
import { buildLocalAgent } from "../lib/security/local-agent";
import { mergeAgent } from "../lib/security/agent";
import type { Mail } from "../types";
import { ExtensionPanel } from "./panel";
import panelCss from "./panel.css?inline";

const SAMPLES = {
  paypal: {
    subject: "Acción urgente: tu cuenta será limitada en 12 horas",
    fromName: "PayPal",
    fromEmail: "service@paypa1-secure.com",
    html: `<p>Hemos detectado un inicio de sesión inusual.</p><p><a href="http://193.0.2.14/paypal-login">Verifica tu identidad ahora</a></p>`,
    file: "paypal-seguridad.pdf",
  },
  marta: {
    subject: "Notas del sprint y el hueco del jueves",
    fromName: "Marta Ruiz",
    fromEmail: "marta.ruiz@northline.es",
    html: `<p>Alex, dejo aquí lo que acordamos ayer. El filtro de alertas sale el jueves.</p>`,
    file: "",
  },
} as const;

function mailFrom(which: keyof typeof SAMPLES): Mail {
  const sample = SAMPLES[which];
  const text = sample.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    id: `lab-${which}`,
    folder: "inbox",
    starred: false,
    unread: false,
    date: new Date().toISOString(),
    from: { name: sample.fromName, email: sample.fromEmail },
    to: [{ name: "Alex", email: "alex@sello.mail" }],
    subject: sample.subject,
    preview: text.slice(0, 140),
    bodyText: text,
    bodyHtml: sample.html,
    attachments: sample.file
      ? [{ id: "lab-pdf", name: sample.file, mime: "application/pdf", size: 0, kind: "pdf" }]
      : [],
    auth: { spf: "none", dkim: "none", dmarc: "none" },
  };
}

export function Home() {
  const [which, setWhich] = useState<keyof typeof SAMPLES>("paypal");
  const [open, setOpen] = useState(true);
  const mail = useMemo(() => mailFrom(which), [which]);
  const report = useMemo(() => {
    const base = analyzeMail(mail);
    return mergeAgent(base, buildLocalAgent(mail, base));
  }, [mail]);

  return (
    <div className="flex h-full min-h-0 bg-paper text-ink">
      <style>{panelCss}</style>
      <main className="app-scroll min-w-0 flex-1 overflow-auto px-6 py-8 sm:px-10">
        <div className="flex items-center gap-3">
          <PumpkinMark className="size-10" />
          <div>
            <p className="text-[1.2rem] font-semibold leading-none">Sello</p>
            <p className="mt-1 text-[0.78rem] text-muted">Barra de vigilancia sobre Gmail</p>
          </div>
        </div>
        <h1 className="mt-8 max-w-xl text-[1.7rem] font-semibold leading-tight">
          Entra en Gmail con tu cuenta, o con cualquier otra. Sello se pone a la derecha.
        </h1>
        <p className="mt-3 max-w-xl text-[0.95rem] leading-relaxed text-muted">
          Ya no hace falta un cliente aparte ni un login extra. Usas Gmail como siempre. La extensión lee el
          correo abierto y enseña la nota, el semáforo y el porqué.
        </p>
        <ol className="mt-6 max-w-xl space-y-3 text-[0.9rem] leading-relaxed">
          <li>
            <strong>1.</strong> Si aún no está empaquetada: <code className="text-navy">pnpm build:extension</code>
          </li>
          <li>
            <strong>2.</strong> En Chrome, Brave o Edge abre las extensiones y activa el modo desarrollador.
          </li>
          <li>
            <strong>3.</strong> Carga la carpeta <code className="text-navy">dist-extension</code>.
          </li>
          <li>
            <strong>4.</strong> Abre{" "}
            <a className="font-semibold text-navy underline" href="https://mail.google.com" target="_blank" rel="noreferrer">
              mail.google.com
            </a>{" "}
            con tu Gmail (o el que quieras) y entra en un mensaje.
          </li>
        </ol>
        <p className="mt-6 max-w-xl text-[0.82rem] leading-relaxed text-muted">
          A la derecha ves cómo queda la barra. Cambia el ejemplo si quieres; en Gmail de verdad usará el correo
          que tengas abierto.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="rounded-full bg-sheet px-3 py-1.5 text-[0.78rem] font-semibold ring-1 ring-line" onClick={() => setWhich("paypal")}>
            Ejemplo peligroso
          </button>
          <button type="button" className="rounded-full bg-sheet px-3 py-1.5 text-[0.78rem] font-semibold ring-1 ring-line" onClick={() => setWhich("marta")}>
            Ejemplo normal
          </button>
        </div>
      </main>
      <div className="w-[22rem] shrink-0 border-l border-line bg-sheet">
        <ExtensionPanel embedded open={open} onToggle={() => setOpen((value) => !value)} mail={mail} report={report} />
      </div>
    </div>
  );
}
