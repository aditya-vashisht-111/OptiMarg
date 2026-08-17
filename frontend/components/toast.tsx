'use client'

import * as React from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'
interface Toast {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const remove = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { ...t, id }])
      setTimeout(() => remove(id), 4500)
    },
    [remove],
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) => toast({ title, description, variant: 'error' }),
      info: (title, description) => toast({ title, description, variant: 'info' }),
    }),
    [toast],
  )

  const icons = {
    success: <CheckCircle2 className="size-4 text-nominal" />,
    error: <XCircle className="size-4 text-alert" />,
    info: <Info className="size-4 text-primary" />,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg animate-in slide-in-from-right-4 fade-in"
          >
            <div className="mt-0.5">{icons[t.variant]}</div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">{t.title}</div>
              {t.description && (
                <div className="mt-0.5 text-xs text-muted-foreground break-words">
                  {t.description}
                </div>
              )}
            </div>
            <button
              onClick={() => remove(t.id)}
              className={cn(
                'rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
              )}
              aria-label="Dismiss notification"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
