'use client'

import * as React from 'react'
import {
  Download,
  UserPlus,
  Database,
  Table2,
  Users,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, Input, Label, Modal } from '@/components/ui/primitives'
import { Plate } from '@/components/plate'
import {
  exportCsvUrl,
  registerUser,
  createTable,
  createUsersTable,
} from '@/lib/fleet'
import { useToast } from '@/components/toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  danger,
  busy,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  busy?: boolean
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className={`flex size-9 items-center justify-center rounded-xl ${danger ? 'bg-alert/12 text-alert' : 'bg-primary/10 text-primary'}`}>
            <AlertTriangle className="size-4.5" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export function AdminView() {
  const toast = useToast()
  const [userModal, setUserModal] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [registering, setRegistering] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)

  const [confirm, setConfirm] = React.useState<null | 'table' | 'users'>(null)
  const [confirmBusy, setConfirmBusy] = React.useState(false)

  const emailValid = EMAIL_RE.test(email)

  async function handleExport() {
    setExporting(true)
    toast.info('Preparing export', 'Streaming fleet live status CSV…')
    try {
      const res = await fetch(exportCsvUrl())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `optimarg-live-status-${Date.now()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded', 'Fleet live status export complete.')
    } catch {
      // Fallback: open the stream endpoint directly
      window.open(exportCsvUrl(), '_blank')
      toast.info('Export opened', 'CSV stream opened in a new tab.')
    } finally {
      setExporting(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!emailValid || password.length < 1) return
    setRegistering(true)
    try {
      await registerUser(email, password)
      toast.success('User registered', email)
      setUserModal(false)
      setEmail('')
      setPassword('')
    } catch (err) {
      toast.error('Registration failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRegistering(false)
    }
  }

  async function runConfirm() {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      if (confirm === 'table') {
        await createTable()
        toast.success('Table initialized', 'POST /create/table succeeded.')
      } else {
        await createUsersTable()
        toast.success('Users table initialized', 'POST /create/users succeeded.')
      }
      setConfirm(null)
    } catch (err) {
      toast.error('Utility failed', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setConfirmBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Admin & Telemetry Data Hub
        </h2>
        <p className="text-xs text-muted-foreground">Exports, user management and database utilities</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Plate title="Telemetry Export" description="GET /fleet/export-csv" icon={Download} modalSize="sm">
          <div className="flex flex-col gap-4 p-5">
            <p className="text-sm text-muted-foreground">
              Refresh the live status view and stream all current fleet records as a CSV download.
            </p>
            <Button onClick={handleExport} disabled={exporting} className="self-start">
              {exporting ? <Loader2 className="animate-spin" /> : <Download />}
              {exporting ? 'Exporting…' : 'Export Fleet CSV'}
            </Button>
          </div>
        </Plate>

        <Plate title="User Management" description="POST /users/register" icon={Users} modalSize="sm">
          <div className="flex flex-col gap-4 p-5">
            <p className="text-sm text-muted-foreground">
              Register a new operator account with a validated email and password.
            </p>
            <Button variant="outline" onClick={() => setUserModal(true)} className="self-start">
              <UserPlus /> Register Operator
            </Button>
          </div>
        </Plate>

        <Plate title="Database Initialization" description="Admin utilities" icon={Database} modalSize="sm" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Table2 className="size-4 text-primary" /> Fleet Table
              </div>
              <p className="text-xs text-muted-foreground">
                Initialize the primary fleet entries table. POST /create/table
              </p>
              <Button variant="outline" size="sm" onClick={() => setConfirm('table')} className="self-start">
                Initialize table
              </Button>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="size-4 text-primary" /> Users Table
              </div>
              <p className="text-xs text-muted-foreground">
                Initialize the operator/users table. POST /create/users
              </p>
              <Button variant="outline" size="sm" onClick={() => setConfirm('users')} className="self-start">
                Initialize users
              </Button>
            </div>
          </div>
        </Plate>
      </div>

      {/* Register user modal */}
      <Modal
        open={userModal}
        onClose={() => setUserModal(false)}
        title="Register Operator"
        description="POST /users/register"
        size="sm"
      >
        <form onSubmit={handleRegister} className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@optimarg.io"
              aria-invalid={email.length > 0 && !emailValid}
            />
            {email.length > 0 && !emailValid && (
              <span className="text-[11px] text-destructive">Enter a valid email address.</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setUserModal(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!emailValid || password.length < 1 || registering}>
              {registering && <Loader2 className="animate-spin" />}
              Register
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        busy={confirmBusy}
        danger
        title={confirm === 'users' ? 'Initialize users table?' : 'Initialize fleet table?'}
        description={
          confirm === 'users'
            ? 'This runs POST /create/users on the backend. Existing structures may be affected.'
            : 'This runs POST /create/table on the backend. Existing structures may be affected.'
        }
        confirmLabel="Run utility"
      />
    </div>
  )
}
