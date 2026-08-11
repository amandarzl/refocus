import { useState, useEffect, useRef } from "react";

export default function Header({
  viewMode,
  theme,
  canvasTitle,
  onTitleChange,
  onToggleTheme,
  onLogoClick,
  onStartDrawing,
  onSaveExit,
  onFinishDrawing,
}) {
  const isDark = theme === "dark";
  const [isEditing, setIsEditing] = useState(false);
  const [tempTitle, setTempTitle] = useState(canvasTitle);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userName, setUserName] = useState(
    () => localStorage.getItem("refocus_username") || "User",
  );
  const dropdownRef = useRef(null);

  useEffect(() => {
    setTempTitle(canvasTitle);
  }, [canvasTitle]);

  const handleSave = () => {
    const finalTitle = tempTitle.trim() || "Untitled Canvas";
    onTitleChange(finalTitle);
    setIsEditing(false);
  };

  useEffect(() => {
    localStorage.setItem("refocus_username", userName);
  }, [userName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportVault = () => {
    const sessions = localStorage.getItem("refocus_sessions");
    if (!sessions) {
      alert("No vault data found to export.");
      return;
    }
    const blob = new Blob([sessions], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `refocus_vault_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-md ${
        isDark
          ? "border-zinc-800 bg-[#1A1A1E]/80"
          : "border-slate-200 bg-white/80"
      }`}
    >
      <div className="relative flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo / Brand */}

        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
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
            className={`text-lg font-semibold tracking-tight ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
          >
            ReFocus
          </span>
        </button>

        {/* Center: CLEAN EDITABLE TITLE (NO LOGOS / NO ICONS) */}
        {viewMode === "workspace" && (
          <div className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 max-w-[120px] xs:max-w-[160px] sm:max-w-[240px] md:max-w-[320px]">
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
                className="bg-zinc-900 !text-white caret-white placeholder-zinc-500 border border-blue-500/80 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-md px-3 py-1 font-semibold text-xs sm:text-sm md:text-base text-center w-full shadow-md"
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full text-zinc-100 hover:text-white hover:bg-zinc-800/80 px-3 py-1 rounded-md transition border border-transparent hover:border-zinc-700 cursor-pointer font-semibold text-xs sm:text-sm md:text-base"
              >
                <span className="truncate block text-zinc-100 hover:text-white">
                  {canvasTitle}
                </span>
              </button>
            )}
          </div>
        )}

        {/* Actions */}

        <div className="flex items-center gap-2">
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
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                  />
                </div>

                <button
                  onClick={handleExportVault}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors text-sm text-zinc-300 hover:text-white"
                >
                  <span>📥</span>
                  <span>Export Vault Backup (.json)</span>
                </button>
              </div>
            )}
          </div>

          {viewMode === "workspace" && (
            /* Workspace view: Save & Exit + Finish Drawing */
            <>
              <button
                onClick={onSaveExit}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  isDark
                    ? "text-slate-300 hover:bg-zinc-800"
                    : "text-slate-600 hover:bg-slate-200"
                }`}
              >
                Save & Exit
              </button>
              <button
                onClick={onFinishDrawing}
                className="rounded-lg bg-[#A8C3A4] px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-[#97b593]"
              >
                FINISH DRAWING
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
