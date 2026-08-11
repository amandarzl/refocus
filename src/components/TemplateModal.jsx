export default function TemplateModal({
  isDark,
  templates,
  onClose,
  onSelect,
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-3xl rounded-2xl border p-6 shadow-2xl sm:p-8 ${
          isDark
            ? "border-zinc-800 bg-[#1F1F23] text-slate-100"
            : "border-slate-200 bg-white text-slate-900"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              SELECT YOUR TEMPLATE FRAMEWORK
            </h2>
            <p
              className={`mt-1 text-sm ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Choose a framework that matches your creative goal.
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

        {/* Framework Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`group flex flex-col rounded-xl border p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                isDark
                  ? "border-zinc-800 bg-[#252529] hover:border-[#A8C3A4]/50"
                  : "border-slate-200 bg-white hover:border-[#A8C3A4]/70 hover:shadow-md"
              }`}
            >
              {/* Template Icon */}
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${
                  isDark ? "bg-[#2E2E33]" : "bg-slate-100"
                }`}
              >
                {template.id === "cute-cozy" && (
                  <svg
                    className={`h-6 w-6 ${
                      isDark ? "text-slate-300" : "text-slate-600"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                )}
                {template.id === "dynamic-action" && (
                  <svg
                    className={`h-6 w-6 ${
                      isDark ? "text-slate-300" : "text-slate-600"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                )}
                {template.id === "blank-canvas" && (
                  <svg
                    className={`h-6 w-6 ${
                      isDark ? "text-slate-300" : "text-slate-600"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
                    />
                  </svg>
                )}
              </div>

              <h3
                className={`mt-4 text-base font-bold ${
                  isDark ? "text-white" : "text-slate-900"
                }`}
              >
                {template.name}
              </h3>
              <p
                className={`mt-1 flex-1 text-sm ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                {template.description}
              </p>

              <button
                onClick={() => onSelect(template)}
                className="mt-5 rounded-lg bg-[#A8C3A4] py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#97b593]"
              >
                SELECT →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
