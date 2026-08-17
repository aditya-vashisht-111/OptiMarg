'use client'

import * as React from 'react'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Badge, Card, Modal } from '@/components/ui/primitives'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { OperationalStatus } from '@/lib/fleet'

/**
 * A "Plate" is a modular workspace card that can expand into a focused modal
 * window. State lives in `children` (rendered once) which is moved between the
 * inline card and the modal via a portal-free conditional, preserving state.
 */
export function Plate({
  title,
  description,
  icon: Icon,
  actions,
  children,
  className,
  bodyClassName,
  modalSize = 'lg',
  expandable = true,
}: {
  title: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  bodyClassName?: string
  modalSize?: 'sm' | 'md' | 'lg' | 'full'
  expandable?: boolean
}) {
  const [expanded, setExpanded] = React.useState(false)

  const header = (inModal: boolean) => (
    <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{title}</div>
          {description && (
            <div className="truncate text-xs text-muted-foreground">{description}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {actions}
        {expandable && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={inModal ? 'Collapse plate' : 'Expand plate to fullscreen'}
            title={inModal ? 'Collapse' : 'Expand plate'}
          >
            {inModal ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        )}
      </div>
    </div>
  )

  // Render children in exactly one place at a time to preserve internal state.
  return (
    <>
      <Card className={cn('flex flex-col overflow-hidden', className)}>
        {header(false)}
        {!expanded && (
          <div className={cn('flex-1', bodyClassName)}>{children}</div>
        )}
        {expanded && (
          <div className="flex flex-1 items-center justify-center p-8 text-center">
            <p className="text-xs text-muted-foreground">
              This plate is open in a focused window.
            </p>
          </div>
        )}
      </Card>

      <Modal open={expanded} onClose={() => setExpanded(false)} size={modalSize}>
        <div className="flex h-full flex-col">
          {header(true)}
          <div className={cn('min-h-0 flex-1 overflow-auto', bodyClassName)}>{children}</div>
        </div>
      </Modal>
    </>
  )
}

/* Status → badge tone + label helpers, shared across the app. */
export function StatusBadge({ status }: { status: OperationalStatus }) {
  const map = {
    Nominal: { tone: 'nominal', dot: 'bg-nominal' },
    'In-Transit': { tone: 'transit', dot: 'bg-transit' },
    Maintenance: { tone: 'alert', dot: 'bg-alert' },
  } as const
  const cfg = map[status]
  return (
    <Badge tone={cfg.tone}>
      <span className={cn('size-1.5 rounded-full', cfg.dot)} />
      {status}
    </Badge>
  )
}
