import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useAppTheme } from '../../theme'
import {
  buildPageTokens,
  clampPage,
  getPageItemRange,
  getTotalPages,
  type PageToken,
} from '../../utils/pagination'

export type { PageToken }
export { buildPageTokens, clampPage, getPageItemRange, getTotalPages }

/** Default rows-per-page choices for every QC surface using Pagination. */
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250] as const

export type PaginationProps = {
  /** Total items in the full dataset (not just the current page). */
  totalItems: number
  /** 1-based current page. */
  page: number
  /** Items shown per page — parent slices the source data for display only. */
  pageSize: number
  /** Called with the next 1-based page. Never mutates the underlying dataset. */
  onPageChange: (page: number) => void
  /** Optional page-size choices for dense tables. Defaults to DEFAULT_PAGE_SIZE_OPTIONS when handler is set. */
  pageSizeOptions?: readonly number[]
  onPageSizeChange?: (pageSize: number) => void
  disabled?: boolean
  className?: string
  /** How many page numbers to keep beside the current page. */
  siblingCount?: number
  /** How many page numbers to always show at each end. */
  boundaryCount?: number
}

function joinClass(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/** Inline colors beat UA / MUI button defaults (Tailwind preflight is disabled). */
type Palette = {
  rootBorder: string
  meta: string
  metaMuted: string
  surface: string
  surfaceHover: string
  surfaceActive: string
  border: string
  borderHover: string
  text: string
  textMuted: string
  textDisabled: string
  currentBg: string
  currentBorder: string
  currentText: string
  disabledBg: string
  disabledBorder: string
  menuBg: string
  menuBorder: string
  optionHover: string
}

const DARK: Palette = {
  rootBorder: '#262629',
  meta: '#e4e4e7',
  metaMuted: '#a1a1aa',
  surface: '#1c1c1f',
  surfaceHover: '#27272a',
  surfaceActive: '#111113',
  border: '#3f3f46',
  borderHover: '#71717a',
  text: '#f4f4f5',
  textMuted: '#a1a1aa',
  textDisabled: '#71717a',
  currentBg: '#2563eb',
  currentBorder: '#3b82f6',
  currentText: '#ffffff',
  disabledBg: '#161618',
  disabledBorder: '#2f2f35',
  menuBg: '#161618',
  menuBorder: '#3f3f46',
  optionHover: '#27272a',
}

const LIGHT: Palette = {
  rootBorder: '#e4e4e7',
  meta: '#18181b',
  metaMuted: '#71717a',
  surface: '#ffffff',
  surfaceHover: '#f4f4f5',
  surfaceActive: '#e4e4e7',
  border: '#d4d4d8',
  borderHover: '#a1a1aa',
  text: '#18181b',
  textMuted: '#52525b',
  textDisabled: '#a1a1aa',
  currentBg: '#2563eb',
  currentBorder: '#1d4ed8',
  currentText: '#ffffff',
  disabledBg: '#f4f4f5',
  disabledBorder: '#e4e4e7',
  menuBg: '#ffffff',
  menuBorder: '#d4d4d8',
  optionHover: '#f4f4f5',
}

const baseBtnClass =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-[2px] border px-2.5 text-[11px] font-medium tabular-nums transition-colors duration-150 select-none sm:text-xs'

type NavButtonProps = {
  label: ReactNode
  ariaLabel: string
  onClick: () => void
  disabled?: boolean
  current?: boolean
  palette: Palette
}

const NavButton = memo(function NavButton({
  label,
  ariaLabel,
  onClick,
  disabled,
  current,
  palette,
}: NavButtonProps) {
  const isDisabled = Boolean(disabled) && !current

  let style: CSSProperties
  if (current) {
    style = {
      backgroundColor: palette.currentBg,
      borderColor: palette.currentBorder,
      color: palette.currentText,
      cursor: 'default',
    }
  } else if (isDisabled) {
    style = {
      backgroundColor: palette.disabledBg,
      borderColor: palette.disabledBorder,
      color: palette.textDisabled,
      cursor: 'not-allowed',
      opacity: 0.85,
    }
  } else {
    style = {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      color: palette.text,
      cursor: 'pointer',
    }
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-current={current ? 'page' : undefined}
      disabled={isDisabled || current}
      onClick={onClick}
      className={baseBtnClass}
      style={style}
      onMouseEnter={(e) => {
        if (current || isDisabled) return
        e.currentTarget.style.backgroundColor = palette.surfaceHover
        e.currentTarget.style.borderColor = palette.borderHover
      }}
      onMouseLeave={(e) => {
        if (current || isDisabled) return
        e.currentTarget.style.backgroundColor = palette.surface
        e.currentTarget.style.borderColor = palette.border
      }}
      onMouseDown={(e) => {
        if (current || isDisabled) return
        e.currentTarget.style.backgroundColor = palette.surfaceActive
      }}
      onMouseUp={(e) => {
        if (current || isDisabled) return
        e.currentTarget.style.backgroundColor = palette.surfaceHover
      }}
    >
      {label}
    </button>
  )
})

type PageSizeSelectProps = {
  value: number
  options: readonly number[]
  disabled?: boolean
  onChange: (pageSize: number) => void
  palette: Palette
}

/** Themed rows-per-page menu — no native select / list bullets. */
const PageSizeSelect = memo(function PageSizeSelect({
  value,
  options,
  disabled,
  onChange,
  palette,
}: PageSizeSelectProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-1.5">
      <span className="text-[11px] leading-none sm:text-xs" style={{ color: palette.metaMuted }}>
        Rows
      </span>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label="Rows per page"
        className={joinClass(baseBtnClass, 'min-w-[3.25rem] justify-between gap-1 px-2')}
        style={{
          backgroundColor: open ? palette.surfaceHover : palette.surface,
          borderColor: open ? palette.currentBorder : palette.border,
          color: palette.text,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.55 : 1,
        }}
        onClick={() => {
          if (!disabled) setOpen((prev) => !prev)
        }}
      >
        <span>{value}</span>
        <span className="text-[9px] leading-none" style={{ color: palette.textMuted }} aria-hidden>
          ▾
        </span>
      </button>
      {open && !disabled && (
        <div
          id={listId}
          role="listbox"
          aria-label="Rows per page"
          className="absolute bottom-[calc(100%+4px)] left-0 z-20 min-w-[3.5rem] overflow-hidden rounded-[2px] py-0.5 shadow-lg"
          style={{
            backgroundColor: palette.menuBg,
            border: `1px solid ${palette.menuBorder}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
          }}
        >
          {options.map((n) => {
            const selected = n === value
            return (
              <button
                key={n}
                type="button"
                role="option"
                aria-selected={selected}
                className="flex w-full items-center px-2.5 py-1.5 text-left text-[11px] font-medium tabular-nums sm:text-xs"
                style={{
                  backgroundColor: selected ? palette.currentBg : palette.menuBg,
                  color: selected ? palette.currentText : palette.text,
                  cursor: 'pointer',
                  border: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = palette.optionHover
                }}
                onMouseLeave={(e) => {
                  if (!selected) e.currentTarget.style.backgroundColor = palette.menuBg
                }}
                onClick={() => {
                  onChange(n)
                  setOpen(false)
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
})

/**
 * Global QC Template pagination control.
 *
 * Parents keep the full dataset and pass only totals + the current window.
 * Changing pages updates display state only — never truncates source data.
 */
export const Pagination = memo(function Pagination({
  totalItems,
  page,
  pageSize,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  disabled = false,
  className,
  siblingCount = 1,
  boundaryCount = 1,
}: PaginationProps) {
  const { mode } = useAppTheme()
  const palette = mode === 'dark' ? DARK : LIGHT

  const resolvedOptions = useMemo(() => {
    const source = pageSizeOptions?.length
      ? [...pageSizeOptions]
      : onPageSizeChange
        ? [...DEFAULT_PAGE_SIZE_OPTIONS]
        : []
    const merged = new Set(source)
    if (onPageSizeChange) {
      merged.add(100)
      merged.add(250)
    }
    return [...merged].sort((a, b) => a - b)
  }, [pageSizeOptions, onPageSizeChange])

  const totalPages = getTotalPages(totalItems, pageSize)
  const currentPage = totalPages > 0 ? clampPage(page, totalPages) : 1
  const { start, end } = getPageItemRange(currentPage, pageSize, totalItems)

  const tokens = useMemo(
    () => buildPageTokens(currentPage, totalPages, { siblingCount, boundaryCount }),
    [currentPage, totalPages, siblingCount, boundaryCount],
  )

  const atFirst = currentPage <= 1 || totalPages === 0
  const atLast = currentPage >= totalPages || totalPages === 0
  const controlsDisabled = disabled || totalPages === 0

  const goTo = (next: number) => {
    if (controlsDisabled) return
    const clamped = clampPage(next, totalPages)
    if (clamped !== currentPage) onPageChange(clamped)
  }

  const rangeLabel =
    totalItems === 0
      ? '0 items'
      : `${start + 1}–${end} of ${totalItems}`

  return (
    <nav
      className={joinClass(
        'flex w-full flex-col gap-2 bg-transparent px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3',
        className,
      )}
      style={{ borderTop: `1px solid ${palette.rootBorder}` }}
      aria-label="Pagination"
      data-total-pages={totalPages}
      data-page={currentPage}
    >
      <div className="flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
        <p
          className="inline-flex items-center text-[11px] leading-none tabular-nums sm:text-xs"
          style={{ color: palette.meta }}
        >
          <span className="font-semibold">{rangeLabel}</span>
          <span className="mx-1.5" style={{ color: palette.metaMuted }} aria-hidden>
            ·
          </span>
          <span style={{ color: palette.metaMuted }}>
            Page {totalPages === 0 ? 0 : currentPage} of {totalPages}
          </span>
        </p>

        {resolvedOptions.length > 0 && onPageSizeChange && (
          <PageSizeSelect
            value={pageSize}
            options={resolvedOptions}
            disabled={disabled}
            palette={palette}
            onChange={(next) => {
              if (!Number.isFinite(next) || next <= 0) return
              onPageSizeChange(next)
            }}
          />
        )}
      </div>

      <div className="flex max-w-full flex-wrap items-center justify-center gap-1 sm:justify-end">
        <NavButton
          label="First"
          ariaLabel="First page"
          palette={palette}
          disabled={controlsDisabled || atFirst}
          onClick={() => goTo(1)}
        />
        <NavButton
          label="Previous"
          ariaLabel="Previous page"
          palette={palette}
          disabled={controlsDisabled || atFirst}
          onClick={() => goTo(currentPage - 1)}
        />

        <div className="hidden flex-wrap items-center justify-center gap-1 min-[480px]:flex">
          {tokens.map((token, index) =>
            token === 'ellipsis' ? (
              <span
                key={`e-${index}`}
                className="inline-flex h-8 min-w-6 items-center justify-center px-1 text-xs"
                style={{ color: palette.textMuted }}
                aria-hidden
              >
                …
              </span>
            ) : (
              <NavButton
                key={token}
                label={token}
                ariaLabel={`Page ${token}`}
                palette={palette}
                current={token === currentPage}
                disabled={controlsDisabled}
                onClick={() => goTo(token)}
              />
            ),
          )}
        </div>

        <NavButton
          label="Next"
          ariaLabel="Next page"
          palette={palette}
          disabled={controlsDisabled || atLast}
          onClick={() => goTo(currentPage + 1)}
        />
        <NavButton
          label="Last"
          ariaLabel="Last page"
          palette={palette}
          disabled={controlsDisabled || atLast}
          onClick={() => goTo(totalPages)}
        />
      </div>
    </nav>
  )
})
