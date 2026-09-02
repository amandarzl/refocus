import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db.js";

export default function Header({
  viewMode,
  theme,
  canvasTitle,
  onTitleChange,
  onToggleTheme,
  onLogoClick,
  onStartDrawing,
  onFinishDrawing,
}) {
  const isDark = theme === "dark";
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(canvasTitle);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userNameSetting = useLiveQuery(() => db.settings.get("username"), []);
  const [userName, setUserName] = useState("User");
  const hasLoadedUserName = useRef(false);
  // Mirrors `userName` for the click-outside handler below, which is set up
  // once (empty dep array) and would otherwise always see the "User" from
  // that first render — a ref's `.current` stays live across renders.
  const userNameRef = useRef(userName);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const importFileInputRef = useRef(null);

  useEffect(() => {
    setTempTitle(canvasTitle);
  }, [canvasTitle]);

  // Pull the saved name from the DB exactly once, the first time the live
  // query resolves — never again after. Syncing on every resolve fought
  // with typing: each keystroke wrote to the DB, the live query re-fired,
  // and this effect stomped the input with that (slightly delayed) value.
  useEffect(() => {
    if (hasLoadedUserName.current || userNameSetting === undefined) return;
    hasLoadedUserName.current = true;
    setUserName(userNameSetting?.value || "User");
  }, [userNameSetting]);

  const handleSave = () => {
    const finalTitle = tempTitle.trim() || "Untitled Canvas";
    onTitleChange(finalTitle);
    setIsEditing(false);
  };

  useEffect(() => {
    userNameRef.current = userName;
  }, [userName]);

  // Commit on blur/Enter, not on every keystroke — same pattern as the
  // canvas-title rename above and the folder rename in FolderList.jsx.
  const commitUserName = () => {
    const finalName = (userNameRef.current || "").trim() || "User";
    setUserName(finalName);
    db.settings.put({ key: "username", value: finalName });
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Clicking outside closes (unmounts) the dropdown immediately, which
        // can beat the input's own blur event to the punch — commit here
        // explicitly so a click-away doesn't silently drop an in-progress edit.
        commitUserName();
        setIsProfileOpen(false);
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        commitUserName();
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportVault = async () => {
    const sessions = await db.sessions.toArray();
    if (!sessions || sessions.length === 0) {
      alert("Your Gallery Vault is empty — there's nothing to back up yet.");
      return;
    }
    const blob = new Blob([JSON.stringify(sessions)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `refocus_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportVault = () => {
    importFileInputRef.current?.click();
  };

  // Always adds the backup's drawings as new entries in the Gallery Vault —
  // never overwrites or replaces anything already there, same "never
  // destructive by default" rule the rest of the app follows.
  const handleImportFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    try {
      const text = await file.text();
      const sessions = JSON.parse(text);
      if (!Array.isArray(sessions) || sessions.length === 0) {
        alert("That file doesn't look like a ReFocus backup — nothing was imported.");
        return;
      }
      const withoutIds = sessions.map(({ id, ...rest }) => rest);
      await db.sessions.bulkAdd(withoutIds);
      alert(
        `Added ${withoutIds.length} drawing${withoutIds.length === 1 ? "" : "s"} from the backup to your Gallery Vault.`,
      );
    } catch (err) {
      console.error("Vault import failed:", err);
      alert("Couldn't read that file — make sure it's a ReFocus backup file.");
    }
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md ${
        isDark
          ? "border-zinc-800 bg-[#1A1A1E]/80"
          : "border-slate-200 bg-white/80"
      }`}
    >
      {/* Shared by both the desktop and mobile "Restore from a Backup"
          buttons below — kept off-screen, triggered via the ref. */}
      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFileSelected}
        className="hidden"
      />
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo / Brand + Breadcrumb Title */}
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onLogoClick}
            className="flex shrink-0 items-center gap-2 transition-opacity hover:opacity-80"
            title="Back to Hub"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#A8C3A4]">
              <svg
                className="h-5 w-5 text-black"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <span
              className={`hidden text-sm font-semibold tracking-tight sm:inline ${
                isDark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              ReFocus
            </span>
          </button>

          {viewMode === "workspace" && (
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className={`hidden text-sm font-light select-none sm:inline ${
                  isDark ? "text-zinc-600" : "text-slate-300"
                }`}
              >
                /
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={tempTitle}
                  onChange={(e) => setTempTitle(e.target.value)}
                  autoFocus
                  onFocus={(e) => e.target.select()}
                  onBlur={handleSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                    if (e.key === "Escape") {
                      setTempTitle(canvasTitle);
                      setIsEditing(false);
                    }
                  }}
                  className={`max-w-[200px] rounded bg-blue-500/10 font-bold text-sm outline-none focus:ring-1 focus:ring-blue-500/50 ${
                    isDark
                      ? "text-white caret-white placeholder-zinc-500"
                      : "text-slate-900 caret-slate-900 placeholder:text-slate-400"
                  }`}
                  style={{
                    width: `${Math.max(tempTitle.length, 1) + 1}ch`,
                    color: isDark ? "#ffffff" : "#0f172a",
                    textShadow: isDark
                      ? "0 0 2px rgba(255,255,255,0.8)"
                      : "none",
                  }}
                />
              ) : (
                <span
                  onClick={() => setIsEditing(true)}
                  className="cursor-pointer truncate font-semibold text-sm max-w-[120px] sm:max-w-[200px]"
                  style={{
                    color: isDark ? "#ffffff" : "#0f172a",
                    textShadow: isDark ? "0 1px 4px rgba(0,0,0,0.5)" : "none",
                  }}
                >
                  {canvasTitle}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Desktop controls (hidden on ≤600px) */}
          <div className="hidden min-[601px]:flex items-center gap-2">
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                isDark
                  ? "text-slate-300 hover:bg-zinc-800"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {isDark ? (
                /* Sun icon */
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
                    d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                  />
                </svg>
              ) : (
                /* Moon icon */
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
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              )}
            </button>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                  isDark
                    ? "text-slate-300 hover:bg-zinc-800"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
                title="User Profile"
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>

              {isProfileOpen && (
                <div
                  ref={dropdownRef}
                  className="absolute right-0 mt-2 w-64 bg-[#1F1F23] border border-zinc-800 rounded-xl shadow-2xl p-4 z-50 text-zinc-200"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <svg
                      className="h-8 w-8 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      onBlur={commitUserName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                      }}
                      className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                    />
                  </div>

                  <button
                    onClick={handleExportVault}
                    title="Downloads a backup file of every drawing saved in your Gallery Vault"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm text-zinc-300 hover:text-white"
                  >
                    <span>💾</span>
                    <span>Save a Backup</span>
                  </button>
                  <button
                    onClick={handleImportVault}
                    title="Adds drawings from a backup file back into your Gallery Vault"
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm text-zinc-300 hover:text-white"
                  >
                    <span>📂</span>
                    <span>Restore from a Backup</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Finish button - always visible */}
          {viewMode === "workspace" && (
            <button
              onClick={onFinishDrawing}
              className="rounded-lg bg-[#A8C3A4] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#97b593]"
            >
              Finish
            </button>
          )}

          {/* Hamburger menu (only on ≤600px) */}
          <div className="relative min-[601px]:hidden" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                isDark
                  ? "text-slate-300 hover:bg-zinc-800"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
              title="Menu"
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {isMenuOpen && (
              <div
                className={`absolute right-0 mt-2 w-56 rounded-xl border shadow-2xl p-2 z-50 ${
                  isDark
                    ? "border-zinc-800 bg-[#1F1F23] text-slate-100"
                    : "border-slate-200 bg-white text-slate-900"
                }`}
              >
                {/* Theme Toggle */}
                <button
                  onClick={() => {
                    onToggleTheme();
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isDark
                      ? "text-slate-300 hover:bg-zinc-800"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {isDark ? (
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
                        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  ) : (
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
                        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                      />
                    </svg>
                  )}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </button>

                {/* User Profile */}
                <div className="border-t mt-1 pt-1">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <svg
                      className="h-5 w-5 text-zinc-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      onBlur={commitUserName}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.target.blur();
                      }}
                      className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                        isDark
                          ? "border-zinc-700 bg-zinc-800 text-zinc-200"
                          : "border-slate-300 bg-white text-slate-900"
                      }`}
                    />
                  </div>
                  <button
                    onClick={handleExportVault}
                    title="Downloads a backup file of every drawing saved in your Gallery Vault"
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isDark
                        ? "text-slate-300 hover:bg-zinc-800"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>💾</span>
                    <span>Save a Backup</span>
                  </button>
                  <button
                    onClick={handleImportVault}
                    title="Adds drawings from a backup file back into your Gallery Vault"
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isDark
                        ? "text-slate-300 hover:bg-zinc-800"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <span>📂</span>
                    <span>Restore from a Backup</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
