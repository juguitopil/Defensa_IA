import { useMail } from "../store";

export function ConfirmDialog() {
  const { state, report, closeConfirm } = useMail();
  const confirm = state.confirm;
  if (!confirm) return null;

  const attachment = report?.attachments.find((item) => item.attachmentId === confirm.attachmentId);
  const link = report?.links.find((item) => item.href === confirm.href);

  function proceed() {
    if (confirm?.kind === "link" && confirm.href) {
      window.open(confirm.href, "_blank", "noopener,noreferrer");
    }
    if (confirm?.kind === "attachment") {
      const mail = state.mails.find((item) => item.id === confirm.mailId);
      const file = mail?.attachments.find((item) => item.id === confirm.attachmentId);
      if (file) {
        const blob = new Blob([file.rawContent ?? "Archivo de laboratorio. Sello no lo abre.\n"], {
          type: file.mime || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        URL.revokeObjectURL(url);
      }
    }
    closeConfirm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-2xl bg-sheet p-5 shadow-[0_18px_50px_rgba(18,36,60,0.2)]"
      >
        <h2 id="confirm-title" className="text-[1.05rem] font-semibold">
          {confirm.kind === "link" ? "Este enlace no es de fiar" : "Este archivo no se va a ejecutar"}
        </h2>
        <p className="mt-2 text-[0.88rem] leading-relaxed text-muted">
          {confirm.kind === "link"
            ? link?.reasons[0] ??
              "El correo ya tiene señales de riesgo. Si abres el enlace, saldrás de Sello."
            : "Solo se hace un análisis estático. Si descargas, guardas el archivo en tu disco; Sello no lo abre."}
        </p>
        <p className="mt-3 break-all rounded-xl bg-paper px-3 py-2 text-[0.78rem] text-ink">
          {confirm.label}
        </p>
        {attachment?.pdfIndicators.length ? (
          <ul className="mt-3 flex flex-col gap-1.5 text-[0.78rem] text-muted">
            {attachment.pdfIndicators.slice(0, 3).map((item) => (
              <li key={item.id}>· {item.label}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeConfirm}
            className="h-9 rounded-lg px-3 text-[0.82rem] font-semibold text-ink hover:bg-paper"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={proceed}
            className="h-9 rounded-lg bg-high px-3 text-[0.82rem] font-semibold text-sheet"
          >
            {confirm.kind === "link" ? "Abrir de todas formas" : "Descargar de todas formas"}
          </button>
        </div>
      </div>
    </div>
  );
}
