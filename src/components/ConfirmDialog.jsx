// Small reusable confirmation modal for destructive actions — same
// centered-overlay structure as TemplateModal.jsx, so it reads as part of
// the app instead of a plain browser confirm() popup.
export default function ConfirmDialog({
  isDark,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

      {/* Dialog */}
      <div
        className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
          isDark ? "border-zinc-800 bg-[#1F1F23] text-slate-100" : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>{message}</p>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              isDark ? "text-slate-300 hover:bg-zinc-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[#E5989B] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#d97f83]"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
