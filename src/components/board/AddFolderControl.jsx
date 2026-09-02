import { useState } from "react";

// Trailing tile in the slot row. Two ways to add a card:
// - "New folder" creates a brand-new folder and attaches it immediately.
// - "Add existing" attaches a folder that already exists in the Add
//   References library (created there, or previously detached) — folders
//   never sync onto the board on their own, this is always an explicit pick.
export default function AddFolderControl({
  isDark,
  existingFolders = [],
  onCreateFolder,
  onAttachFolder,
}) {
  const [mode, setMode] = useState(null); // null | "create" | "pick"
  const [name, setName] = useState("");

  const submitCreate = () => {
    const trimmed = name.trim();
    if (trimmed) onCreateFolder(trimmed);
    setName("");
    setMode(null);
  };

  const tileClass = `flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed transition-colors ${
    isDark
      ? "border-zinc-700 text-zinc-500 hover:border-[#A8C3A4] hover:text-[#A8C3A4]"
      : "border-slate-300 text-slate-400 hover:border-[#A8C3A4] hover:text-[#5c7658]"
  }`;

  return (
    <div>
      <div className={tileClass}>
        {mode === "create" ? (
          <input
            autoFocus
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submitCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitCreate();
              if (e.key === "Escape") {
                setName("");
                setMode(null);
              }
            }}
            placeholder="Folder name"
            className={`w-4/5 rounded-lg border px-2 py-1 text-center text-sm outline-none ${
              isDark
                ? "border-zinc-700 bg-[#1A1A1E] text-slate-100 placeholder:text-zinc-600"
                : "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
            }`}
          />
        ) : mode === "pick" ? (
          <div className="flex h-full w-full flex-col gap-1 overflow-y-auto p-2 text-left">
            {existingFolders.length === 0 ? (
              <span className="px-1 text-xs">No other folders yet — add one from Add References.</span>
            ) : (
              existingFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    onAttachFolder(f.id);
                    setMode(null);
                  }}
                  className={`truncate rounded-lg px-2 py-1.5 text-left text-xs font-semibold transition-colors ${
                    isDark ? "hover:bg-zinc-800 hover:text-[#A8C3A4]" : "hover:bg-slate-100 hover:text-[#5c7658]"
                  }`}
                >
                  {f.name}
                </button>
              ))
            )}
            <button
              onClick={() => setMode(null)}
              className={`mt-auto text-center text-[11px] underline ${isDark ? "text-zinc-500" : "text-slate-400"}`}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="text-2xl font-light leading-none">+</span>
            <button onClick={() => setMode("create")} className="text-xs font-semibold hover:underline">
              New folder
            </button>
            {onAttachFolder && (
              <button onClick={() => setMode("pick")} className="text-[11px] hover:underline">
                Add existing
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
