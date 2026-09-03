// Shared button component — replaces the same "primary sage CTA" being
// independently re-padded/re-rounded in every file it appeared in
// (py-2/py-2.5/py-3, rounded-lg/rounded-xl, all for the identical role).
// The `icon` variant *requires* a `label`, which it renders as both
// `title` (mouse) and `aria-label` (screen reader) — the fix for icon-only
// buttons across the app relying on `title` alone is structural here,
// not left to per-instance discipline.
const VARIANTS = {
  primary:
    "bg-accent-primary text-accent-primary-ink hover:bg-accent-primary-hover",
  secondary:
    "bg-surface-sunken text-ink-primary border border-border hover:bg-surface-raised",
  danger: "bg-danger text-white hover:bg-danger-hover",
  ghost: "text-ink-secondary hover:bg-surface-sunken hover:text-ink-primary",
};

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface-canvas";

export default function Button({
  variant = "primary",
  icon = false,
  label,
  className = "",
  children,
  ...props
}) {
  if (icon && !label && import.meta.env.DEV) {
    console.warn("Button: an icon button should always receive a `label` for accessibility.");
  }

  const shape = icon
    ? "flex h-9 w-9 items-center justify-center rounded-control"
    : "inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-bold";

  return (
    <button
      title={label}
      aria-label={icon ? label : undefined}
      className={`${shape} transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${FOCUS_RING} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
