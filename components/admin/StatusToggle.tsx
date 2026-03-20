"use client"

type StatusToggleProps = {
  checked: boolean
  checkedLabel: string
  uncheckedLabel: string
  title?: string
  disabled?: boolean
  busy?: boolean
  onChange: (nextChecked: boolean) => void
}

export default function StatusToggle({
  checked,
  checkedLabel,
  uncheckedLabel,
  title,
  disabled = false,
  busy = false,
  onChange
}: StatusToggleProps) {
  const isDisabled = disabled || busy

  return (
    <label
      className={`inline-flex flex-col gap-1 ${isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      {title ? (
        <span className="text-[10px] uppercase tracking-[0.14em] text-gray-500 dark:text-gray-400">
          {title}
        </span>
      ) : null}

      <span className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          disabled={isDisabled}
          className="sr-only peer"
        />

        <span className="group relative border border-gray-500/60 shadow-inner shadow-gray-900/30 ring-0 bg-gradient-to-tr from-rose-100 via-rose-400 to-rose-500 rounded-full outline-none duration-300 after:duration-300 w-16 h-9 shadow-sm peer-checked:bg-emerald-500 peer-focus:outline-none after:content-['✖️'] after:text-[11px] after:rounded-full after:absolute after:bg-gray-50 after:border after:border-gray-500/60 after:outline-none after:h-7 after:w-7 after:top-0.5 after:left-0.5 after:-rotate-180 after:flex after:justify-center after:items-center peer-checked:after:translate-x-8 peer-checked:after:content-['✔️'] peer-hover:after:scale-95 peer-checked:after:rotate-0 peer-checked:bg-gradient-to-tr peer-checked:from-green-100 peer-checked:via-lime-400 peer-checked:to-lime-500" />

        <span className="min-w-[4.75rem] whitespace-nowrap text-[11px] font-medium text-gray-700 dark:text-gray-200">
          {busy ? "Updating..." : checked ? checkedLabel : uncheckedLabel}
        </span>
      </span>
    </label>
  )
}
