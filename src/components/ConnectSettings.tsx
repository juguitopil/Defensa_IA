import { X } from "lucide-react";
import { parseEml } from "../lib/import/eml";
import { useMail } from "../store";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.97 10.97 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.72.13-1.43.34-2.09V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z" />
    </svg>
  );
}

export function ConnectSettings() {
  const { state, closeSettings, connectGmail, disconnectGmail, importMail } = useMail();

  if (!state.settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        className="app-scroll max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-sheet p-6 shadow-[0_18px_50px_rgba(18,36,60,0.2)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="connect-title" className="text-[1.15rem] font-semibold">
              Entra en Sello
            </h2>
            <p className="mt-1 text-[0.85rem] leading-relaxed text-muted">
              Elige cualquier cuenta de Google. Sello solo lee; no envía ni borra nada en Gmail.
            </p>
          </div>
          <button
            type="button"
            onClick={closeSettings}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>

        <button
          type="button"
          disabled={state.connecting || state.loadingMailbox}
          onClick={() => void connectGmail()}
          className="mt-5 flex h-11 w-full items-center justify-center gap-3 rounded-xl bg-sheet text-[0.92rem] font-semibold text-ink ring-1 ring-line hover:bg-paper disabled:opacity-60"
        >
          <GoogleMark />
          {state.connecting || state.loadingMailbox ? "Abriendo Google…" : "Continuar con Google"}
        </button>

        <label className="relative mt-3 flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-paper text-[0.88rem] font-semibold text-ink">
          Analizar un correo que ya tengas
          <input
            type="file"
            accept=".eml,message/rfc822"
            className="absolute inset-0 cursor-pointer opacity-0"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              importMail(parseEml(await file.text()));
            }}
          />
        </label>

        <button
          type="button"
          onClick={closeSettings}
          className="mt-2 h-10 w-full text-[0.82rem] font-semibold text-muted hover:text-ink"
        >
          Seguir con la bandeja de prueba
        </button>

        {(state.source === "gmail" || state.source === "google") && (
          <button
            type="button"
            onClick={disconnectGmail}
            className="mt-1 h-10 w-full text-[0.82rem] font-semibold text-muted hover:text-ink"
          >
            Cerrar sesión de Google
          </button>
        )}

        {state.mailboxError && <p className="mt-3 text-[0.8rem] leading-relaxed text-high">{state.mailboxError}</p>}
      </div>
    </div>
  );
}
