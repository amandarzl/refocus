import { useState, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db.js";
import Button from "./ui/Button.jsx";
import Popover from "./ui/Popover.jsx";
import InlineRenameField from "./ui/InlineRenameField.jsx";

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

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const userNameSetting = useLiveQuery(() => db.settings.get("username"), []);
  const [userName, setUserName] = useState("User");
  const hasLoadedUserName = useRef(false);
  const importFileInputRef = useRef(null);

  // Pull the saved name from the DB exactly once, the first time the live
  // query resolves — never again after. Syncing on every resolve fought
  // with typing: each keystroke wrote to the DB, the live query re-fired,
  // and this effect stomped the input with that (slightly delayed) value.
  useEffect(() => {
    if (hasLoadedUserName.current || userNameSetting === undefined) return;
    hasLoadedUserName.current = true;
    setUserName(userNameSetting?.value || "User");
  }, [userNameSetting]);

  // Commit on blur/Enter, not on every keystroke — same pattern the canvas
  // title (via InlineRenameField) and the folder rename fields use.
  const commitUserName = () => {
    const finalName = (userName || "").trim() || "User";
    setUserName(finalName);
    db.settings.put({ key: "username", value: finalName });
  };

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

  const themeIcon = isDark ? (
    /* Sun icon */
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ) : (
    /* Moon icon */
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
      />
    </svg>
  );

  const profileIcon = (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-surface-canvas/80 backdrop-blur-md">
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
            <div className="flex h-8 w-8 items-center justify-center rounded-control bg-accent-primary">
              <svg className="h-5 w-5 text-accent-primary-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <span className="hidden font-display text-sm font-semibold tracking-tight text-ink-primary sm:inline">
              ReFocus
            </span>
          </button>

          {viewMode === "workspace" && (
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="hidden select-none text-sm font-light text-ink-muted sm:inline">/</span>
              <InlineRenameField
                value={canvasTitle}
                onSave={onTitleChange}
                fallback="Untitled Canvas"
                className="max-w-[120px] text-sm font-semibold text-ink-primary sm:max-w-[200px]"
                inputClassName="text-sm text-ink-primary"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Desktop controls (hidden below the sm breakpoint) */}
          <div className="hidden items-center gap-2 sm:flex">
            <Button variant="ghost" icon label={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"} onClick={onToggleTheme}>
              {themeIcon}
            </Button>

            {/* User Profile */}
            <div className="relative">
              <Button
                variant="ghost"
                icon
                label="User Profile"
                onClick={() => setIsProfileOpen((v) => !v)}
              >
                {profileIcon}
              </Button>

              <Popover
                isOpen={isProfileOpen}
                onClose={() => {
                  commitUserName();
                  setIsProfileOpen(false);
                }}
                width="w-64"
              >
                <div className="p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <svg className="h-8 w-8 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                      className="w-full rounded-control border border-border bg-surface-sunken px-3 py-1.5 text-sm text-ink-primary outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                  </div>

                  <button
                    onClick={handleExportVault}
                    title="Downloads a backup file of every drawing saved in your Gallery Vault"
                    className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                  >
                    <span>💾</span>
                    <span>Save a Backup</span>
                  </button>
                  <button
                    onClick={handleImportVault}
                    title="Adds drawings from a backup file back into your Gallery Vault"
                    className="flex w-full items-center gap-2 rounded-control px-3 py-2 text-sm text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                  >
                    <span>📂</span>
                    <span>Restore from a Backup</span>
                  </button>
                </div>
              </Popover>
            </div>
          </div>

          {/* Finish button - always visible */}
          {viewMode === "workspace" && (
            <Button variant="primary" onClick={onFinishDrawing}>
              Finish
            </Button>
          )}

          {/* Hamburger menu (below the sm breakpoint only) */}
          <div className="relative sm:hidden">
            <Button variant="ghost" icon label="Menu" onClick={() => setIsMenuOpen((v) => !v)}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>

            <Popover
              isOpen={isMenuOpen}
              onClose={() => {
                commitUserName();
                setIsMenuOpen(false);
              }}
              width="w-56"
            >
              <div className="p-2">
                <button
                  onClick={() => {
                    onToggleTheme();
                    setIsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                >
                  {themeIcon}
                  <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                </button>

                <div className="mt-1 border-t border-border pt-1">
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    <svg className="h-5 w-5 text-ink-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                      className="w-full rounded-control border border-border bg-surface-sunken px-3 py-1.5 text-sm text-ink-primary outline-none focus:ring-1 focus:ring-focus-ring"
                    />
                  </div>
                  <button
                    onClick={handleExportVault}
                    title="Downloads a backup file of every drawing saved in your Gallery Vault"
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                  >
                    <span>💾</span>
                    <span>Save a Backup</span>
                  </button>
                  <button
                    onClick={handleImportVault}
                    title="Adds drawings from a backup file back into your Gallery Vault"
                    className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink-primary"
                  >
                    <span>📂</span>
                    <span>Restore from a Backup</span>
                  </button>
                </div>
              </div>
            </Popover>
          </div>
        </div>
      </div>
    </header>
  );
}
