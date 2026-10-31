import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMail } from "../store";

export function ComposeDialog() {
  const { state, closeCompose, sendCompose } = useMail();
  const draft = state.compose;
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draft) return;
    setTo(draft.to);
    setSubject(draft.subject);
    setBody(draft.body);
    setError(null);
  }, [draft]);

  if (!draft) return null;

  const title =
    draft.mode === "reply" ? "Responder" : draft.mode === "forward" ? "Reenviar" : "Correo nuevo";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/35 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
        className="flex w-full max-w-[40rem] flex-col rounded-2xl bg-sheet shadow-[0_18px_50px_rgba(18,36,60,0.18)]"
      >
        <div className="flex h-12 items-center justify-between border-b border-line px-4">
          <h2 id="compose-title" className="text-[0.95rem] font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={closeCompose}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
        <form
          className="flex flex-col gap-0"
          onSubmit={(event) => {
            event.preventDefault();
            if (!to.includes("@")) {
              setError("Indica un destinatario con @. El envío es simulado y se guarda en Enviados.");
              return;
            }
            void sendCompose({ ...draft, to, subject, body });
          }}
        >
          <Field label="Para" value={to} onChange={setTo} placeholder="persona@empresa.com" />
          <Field label="Asunto" value={subject} onChange={setSubject} placeholder="Asunto" />
          <label className="px-4 pt-3">
            <span className="sr-only">Mensaje</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={10}
              placeholder="Escribe aquí. El envío no sale de esta demo."
              className="w-full resize-none bg-transparent text-[0.95rem] leading-relaxed outline-none placeholder:text-faint"
            />
          </label>
          {error && <p className="px-4 pb-2 text-[0.78rem] text-high">{error}</p>}
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
            <p className="text-[0.72rem] text-muted">Envío simulado. No se entrega a nadie.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeCompose}
                className="h-9 rounded-lg px-3 text-[0.82rem] font-semibold text-muted hover:bg-paper"
              >
                Descartar
              </button>
              <button
                type="submit"
                className="h-9 rounded-lg bg-navy px-4 text-[0.82rem] font-semibold text-sheet hover:bg-navy-deep"
              >
                Enviar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-3 border-b border-line px-4">
      <span className="w-14 text-[0.75rem] font-semibold text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-10 flex-1 bg-transparent text-[0.9rem] outline-none placeholder:text-faint"
      />
    </label>
  );
}
