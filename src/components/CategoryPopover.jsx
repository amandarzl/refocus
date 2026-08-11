const MAX_IMAGES = 3;

export default function CategoryPopover({
  groups,
  isDark,
  rejectedGroupId,
  onSelect,
  onClose,
}) {
  return (
    <>
      {/* Backdrop to close on outside click */}
      <div
        className="fixed inset-0 z-30"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Popover anchored above the FAB */}
      <div
        className={`absolute bottom-24 left-6 z-40 w-72 overflow-hidden rounded-2xl border shadow-2xl ${
          isDark ? "border-zinc-700 bg-[#242428]" : "border-slate-200 bg-white"
        }`}
        role="menu"
        aria-label="Select a reference category"
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b px-4 py-3 ${
            isDark ? "border-zinc-800" : "border-slate-100"
          }`}
        >
          <h3
            className={`text-sm font-bold ${
              isDark ? "text-slate-100" : "text-slate-900"
            }`}
          >
            Add Reference
          </h3>
          <button
            onClick={onClose}
            className={`rounded-lg p-1 transition-colors ${
              isDark
                ? "text-slate-400 hover:bg-zinc-800 hover:text-slate-200"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
            title="Close"
            aria-label="Close category menu"
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

        {/* Category list */}
        <div className="p-2">
          {groups.map((group) => {
            const isFull = group.images.length >= MAX_IMAGES;
            const isRejected = rejectedGroupId === group.id;

            return (
              <button
                key={group.id}
                onClick={() => onSelect(group)}
                role="menuitem"
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                  isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"
                } ${
                  isRejected
                    ? "border-2 !border-[#E5989B] animate-shake"
                    : "border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Category icon */}
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      isFull
                        ? "bg-[#E5989B]/20 text-[#E5989B]"
                        : "bg-[#A8C3A4]/20 text-[#A8C3A4]"
                    }`}
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
                        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                      />
                    </svg>
                  </div>

                  <div>
                    <p
                      className={`text-sm font-semibold ${
                        isDark ? "text-slate-100" : "text-slate-900"
                      }`}
                    >
                      {group.title}
                    </p>
                    <p
                      className={`text-xs ${
                        isDark ? "text-slate-500" : "text-slate-400"
                      }`}
                    >
                      {group.subtitle}
                    </p>
                  </div>
                </div>

                {/* Capacity badge */}
                {isFull ? (
                  <span className="rounded-full bg-[#E5989B] px-2 py-0.5 text-xs font-bold text-[#1A1A1E]">
                    {group.images.length}/{MAX_IMAGES} FULL
                  </span>
                ) : (
                  <span className="rounded-full bg-[#A8C3A4] px-2 py-0.5 text-xs font-semibold text-[#1A1A1E]">
                    {group.images.length}/{MAX_IMAGES}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
