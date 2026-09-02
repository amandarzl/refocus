import { useState } from "react";

// Toolbar counterpart to AddFolderControl's grid tile — same two actions
// ("New folder" / "Add existing"), just anchored to a small "+" button
// instead of taking up a full card's worth of grid space. Panel styling
// matches Focus Mode's "⋯ More options" dropdown for consistency.
const MIN_FOLDERS = 1;
const MAX_FOLDERS = 20;

export default function AddFolderMenu({
  isDark,
  existingFolders = [],
  onCreateFolders,
  onAttachFolder,
  onClose,
}) {
  const [mode, setMode] = useState(null); // null | "create" | "pick"
  const [count, setCount] = useState("1");

  const submitCreate = () => {
    const clamped = Math.min(MAX_FOLDERS, Math.max(MIN_FOLDERS, parseInt(count, 10) || MIN_FOLDERS));
    onCreateFolders(clamped);
    setCount("1");
    onClose();
  };

  return (
    <div
      className={`absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border shadow-2xl ${
        isDark ? "border-zinc-700 bg-[#242428]" : "border-slate-200 bg-white"
      }`}
    >
      {mode === "create" ? (
        <div className="p-2">
          <label
            className={`mb-1.5 block text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}
          >
            How many folders?
          </label>
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              type="number"
              min={MIN_FOLDERS}
              max={MAX_FOLDERS}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitCreate();
                if (e.key === "Escape") {
                  setCount("1");
                  onClose();
                }
              }}
              className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none ${
                isDark
                  ? "border-zinc-700 bg-[#1A1A1E] text-slate-100 placeholder:text-zinc-600"
                  : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
              }`}
            />
            <button
              onClick={submitCreate}
              className="shrink-0 rounded-lg bg-[#A8C3A4] px-3 py-1.5 text-xs font-bold text-black transition-colors hover:bg-[#97b593]"
            >
              Create
            </button>
          </div>
        </div>
      ) : mode === "pick" ? (
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto p-2">
          {existingFolders.length === 0 ? (
            <span className={`px-2 py-1 text-xs ${isDark ? "text-zinc-500" : "text-slate-400"}`}>
              No other folders yet — add one from Add References.
            </span>
          ) : (
            existingFolders.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  onAttachFolder(f.id);
                  onClose();
                }}
                className={`truncate rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors ${
                  isDark ? "text-slate-200 hover:bg-zinc-800 hover:text-[#A8C3A4]" : "text-slate-700 hover:bg-slate-100 hover:text-[#5c7658]"
                }`}
              >
                {f.name}
              </button>
            ))
          )}
        </div>
      ) : (
        <div className="p-1">
          <button
            onClick={() => setMode("create")}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors ${
              isDark ? "text-slate-200 hover:bg-zinc-800" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            + New folder
          </button>
          {onAttachFolder && (
            <button
              onClick={() => setMode("pick")}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                isDark ? "text-slate-200 hover:bg-zinc-800" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              Add existing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
