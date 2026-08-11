import { useRef, useState } from "react";

export default function FinishModal({ isDark, goal, onClose, onSave }) {
  const [image, setImage] = useState(null);
  const [notes, setNotes] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImage(URL.createObjectURL(file));
  };

  const handleSave = () => {
    const session = {
      id: Date.now(),
      goal,
      image,
      notes,
      date: new Date().toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    };
    onSave(session);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl sm:p-8 ${
          isDark
            ? "border-zinc-800 bg-[#1F1F23] text-slate-100"
            : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Finish Drawing</h2>
            <p
              className={`mt-1 text-sm ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Review your work before saving to the vault.
            </p>
          </div>
          <button
            onClick={onClose}
            className={`rounded-lg p-2 transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-zinc-800 hover:text-slate-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title="Close"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-5">
          {/* Goal badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#A8C3A4] px-3 py-1 text-xs font-bold text-[#1A1A1E]">
              {goal}
            </span>
          </div>

          {/* Drawing Snapshot Upload */}
          <div>
            <label
              className={`mb-2 block text-xs font-bold uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Drawing Snapshot
            </label>
            {image ? (
              <div className="relative overflow-hidden rounded-xl">
                <img
                  src={image}
                  alt="Drawing snapshot preview"
                  className="h-48 w-full object-cover"
                />
                <button
                  onClick={() => {
                    setImage(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="absolute top-2 right-2 rounded-lg bg-black/60 p-1.5 text-white backdrop-blur-sm transition-colors hover:bg-black/80"
                  title="Remove snapshot"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors ${
                  isDark
                    ? "border-zinc-700 bg-[#252529] hover:border-zinc-500"
                    : "border-slate-300 bg-slate-50 hover:border-slate-400"
                }`}
              >
                <svg
                  className={`h-8 w-8 ${
                    isDark ? "text-slate-500" : "text-slate-400"
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                  />
                </svg>
                <span
                  className={`text-sm font-medium ${
                    isDark ? "text-slate-400" : "text-slate-500"
                  }`}
                >
                  Upload drawing snapshot
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Review Notes */}
          <div>
            <label
              className={`mb-2 block text-xs font-bold uppercase tracking-wider ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Review Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes about this session..."
              className={`w-full resize-none rounded-xl border px-4 py-3 text-sm outline-none transition-colors focus:border-[#A8C3A4] ${
                isDark
                  ? "border-zinc-700 bg-[#252529] text-slate-100 placeholder:text-slate-500"
                  : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              }`}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
                isDark
                  ? "text-slate-300 hover:bg-zinc-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-xl bg-[#A8C3A4] px-4 py-3 text-sm font-bold text-black shadow-lg transition-colors hover:bg-[#97b593]"
            >
              Save to Vault & Return to Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
