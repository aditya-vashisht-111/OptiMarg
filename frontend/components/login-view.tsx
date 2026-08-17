'use client'

import * as React from 'react'
import { Radar, Lock, Mail, ArrowRight } from 'lucide-react'

export function LoginView({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    // Demo gate — any credentials are accepted.
    onAuthenticated()
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Radar className="size-6" />
          </span>
          <h1 className="text-lg font-semibold tracking-tight text-foreground">OptiMarg Command Center</h1>
          <p className="mt-1 text-sm text-muted-foreground text-pretty">
            Autonomous Fleet Intelligence &amp; Logistics
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-foreground">Admin sign in</h2>
          <p className="mt-1 text-xs text-muted-foreground">Enter your credentials to access the console.</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@optimarg.io"
                  className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-foreground">Password</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            </label>
          </div>

          <button
            type="submit"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Enter Command Center
            <ArrowRight className="size-4" />
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Restricted access · Authorized personnel only
        </p>
      </div>
    </div>
  )
}
