'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

/* ----------------------------- Card ----------------------------- */
export function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground shadow-[0_1px_2px_oklch(0.4_0.03_60/0.04),0_8px_24px_oklch(0.4_0.03_60/0.05)]',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return (
    <h3
      className={cn('text-sm font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-xs text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-5 pb-5', className)} {...props} />
}

/* ----------------------------- Badge ---------------------------- */
const badgeTones = {
  neutral: 'bg-muted text-muted-foreground border-border',
  nominal: 'bg-nominal/12 text-nominal border-nominal/25',
  transit: 'bg-transit/18 text-transit-foreground border-transit/35',
  alert: 'bg-alert/12 text-alert border-alert/25',
  brand: 'bg-primary/10 text-primary border-primary/25',
} as const

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: keyof typeof badgeTones }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none',
        badgeTones[tone],
        className,
      )}
      {...props}
    />
  )
}

/* ---------------------------- Input ----------------------------- */
export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors',
        'placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      className={cn('text-xs font-medium text-foreground', className)}
      {...props}
    />
  )
}

/* --------------------------- Select ----------------------------- */
export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full appearance-none rounded-lg border border-input bg-background px-3 pr-8 text-sm text-foreground shadow-sm transition-colors',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none',
        "bg-[right_0.6rem_center] bg-no-repeat bg-[length:0.9rem] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%238a7a68%22 stroke-width=%222.2%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')]",
        className,
      )}
      {...props}
    />
  )
}

/* ---------------------------- Switch ---------------------------- */
export function Switch({
  checked,
  onCheckedChange,
  id,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  id?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
        checked ? 'border-nominal/40 bg-nominal/85' : 'border-border bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block size-3.5 rounded-full bg-card shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

/* --------------------------- Progress --------------------------- */
export function Progress({
  value,
  tone = 'brand',
  className,
}: {
  value: number
  tone?: 'brand' | 'nominal' | 'transit' | 'alert'
  className?: string
}) {
  const toneMap = {
    brand: 'bg-primary',
    nominal: 'bg-nominal',
    transit: 'bg-transit',
    alert: 'bg-alert',
  }
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}>
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', toneMap[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

/* --------------------------- Skeleton --------------------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

/* ----------------------------- Modal ---------------------------- */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
}) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizeMap = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    full: 'max-w-[96vw] h-[92vh]',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/25 backdrop-blur-[2px] animate-in fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95',
          sizeMap[size],
          size !== 'full' && 'max-h-[88vh]',
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              {title && <div className="text-sm font-semibold text-foreground">{title}</div>}
              {description && (
                <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
              )}
            </div>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
