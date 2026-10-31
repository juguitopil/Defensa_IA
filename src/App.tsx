import { useEffect } from "react";
import { ConnectSettings } from "./components/ConnectSettings";
import { ComposeDialog } from "./components/ComposeDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { MailList } from "./components/MailList";
import { ReadingPane } from "./components/ReadingPane";
import { SecurityPanel } from "./components/SecurityPanel";
import { Sidebar } from "./components/Sidebar";
import { MailProvider, useMail } from "./store";

export default function App() {
  return (
    <MailProvider>
      <Shell />
    </MailProvider>
  );
}

function Shell() {
  const { state, selected, clearToast } = useMail();

  useEffect(() => {
    if (!state.toast) return;
    const timer = window.setTimeout(() => clearToast(), 2800);
    return () => window.clearTimeout(timer);
  }, [state.toast, clearToast]);

  return (
    <div className="flex h-full min-h-0 bg-paper text-ink">
      <div className="hidden md:block">
        <Sidebar />
      </div>
      <div
        className={`min-w-0 flex-1 ${
          state.mobilePane === "read" && selected ? "hidden lg:flex" : "flex"
        }`}
      >
        <MailList />
      </div>
      <div
        className={`min-w-0 flex-1 ${
          state.mobilePane === "read" && selected ? "flex" : "hidden lg:flex"
        }`}
      >
        <ReadingPane />
      </div>
      <div className="hidden xl:flex">
        <SecurityPanel />
      </div>
      {state.securityOpen && selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 max-h-[55vh] border-t border-line xl:hidden">
          <SecurityPanel />
        </div>
      )}
      <MobileBar />
      {(state.connecting || state.loadingMailbox) && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-ink/25">
          <p className="rounded-full bg-sheet px-4 py-2 text-[0.85rem] font-medium">
            {state.loadingMailbox ? "Leyendo tu bandeja de Gmail…" : "Esperando a Google…"}
          </p>
        </div>
      )}
      <ConnectSettings />
      <ComposeDialog />
      <ConfirmDialog />
      {state.toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[0.8rem] font-medium text-sheet">
          {state.toast}
        </div>
      )}
    </div>
  );
}

function MobileBar() {
  const { state, setNav, openCompose, toggleSecurity } = useMail();
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-center justify-around border-t border-line bg-sheet px-2 md:hidden">
      <button type="button" className="text-[0.72rem] font-semibold text-navy" onClick={() => setNav("inbox")}>
        Bandeja
      </button>
      <button type="button" className="text-[0.72rem] font-semibold text-navy" onClick={() => setNav("alerts")}>
        Alertas
      </button>
      <button type="button" className="text-[0.72rem] font-semibold text-navy" onClick={() => openCompose({ mode: "new" })}>
        Redactar
      </button>
      <button
        type="button"
        className="text-[0.72rem] font-semibold text-navy"
        onClick={() => toggleSecurity(!state.securityOpen)}
      >
        {state.securityOpen ? "Ocultar sello" : "Seguridad"}
      </button>
    </div>
  );
}
