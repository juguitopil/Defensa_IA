import { useEffect, useMemo, useState } from "react";
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
    html: `<p>Hemos detectado un inicio de sesión inusual.</p><p><a href="http://193.0.2.14/paypal-login">Verifica tu identidad ahora</a></p><p>Si no lo haces, tu cuenta PayPal será limitada.</p>`,
    file: "paypal-seguridad.pdf",
  },
  marta: {
    subject: "Notas del sprint y el hueco del jueves",
    fromName: "Marta Ruiz",
    fromEmail: "marta.ruiz@northline.es",
    html: `<p>Alex, dejo aquí lo que acordamos ayer.</p><p>El filtro de alertas sale el jueves. Nos vemos en la sala 3.</p><p>— Marta</p>`,
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

export function GmailLab() {
  const [which, setWhich] = useState<keyof typeof SAMPLES>("paypal");
  const [open, setOpen] = useState(true);
  const mail = useMemo(() => mailFrom(which), [which]);
  const report = useMemo(() => {
    const base = analyzeMail(mail);
    return mergeAgent(base, buildLocalAgent(mail, base));
  }, [mail]);
  const sample = SAMPLES[which];

  useEffect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-sello-lab", "1");
    style.textContent = panelCss;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div className="flex h-full min-h-0 bg-[#f6f8fc] text-[#1a2433]">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-[#c5d0db] bg-white px-4">
          <p className="text-sm font-semibold">Gmail · laboratorio de Sello</p>
          <button type="button" className="rounded-full bg-[#e4ebf1] px-3 py-1 text-xs font-semibold" onClick={() => setWhich("paypal")}>
            Correo peligroso
          </button>
          <button type="button" className="rounded-full bg-[#e4ebf1] px-3 py-1 text-xs font-semibold" onClick={() => setWhich("marta")}>
            Correo normal
          </button>
        </header>
        <div className="nH if min-h-0 flex-1 overflow-auto p-6">
          <div className="ha">
            <h2 className="hP text-2xl font-semibold">{sample.subject}</h2>
          </div>
          <div className="adn ads gs mt-4 rounded-2xl bg-white p-5 shadow-sm" data-message-id={`lab-${which}`}>
            <div className="flex items-center gap-2 text-sm">
              <span className="gD font-semibold" {...{ email: sample.fromEmail }} data-name={sample.fromName}>
                {sample.fromName}
              </span>
              <span className="go text-[#536274]">&lt;{sample.fromEmail}&gt;</span>
              <span className="g3 ml-auto text-xs text-[#7b8b9c]" title={mail.date}>
                ahora
              </span>
            </div>
            <div className="ii gt mt-4">
              <div className="a3s aiL text-[0.95rem] leading-relaxed" dangerouslySetInnerHTML={{ __html: sample.html }} />
            </div>
            {sample.file && (
              <div className="aQH mt-4">
                <span className="aZo aV3 rounded-lg bg-[#e4ebf1] px-3 py-2 text-sm">{sample.file}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="w-[22rem] shrink-0 border-l border-[#c5d0db] bg-[#f8fafc]">
        <ExtensionPanel embedded open={open} onToggle={() => setOpen((value) => !value)} mail={mail} report={report} />
      </div>
    </div>
  );
}
