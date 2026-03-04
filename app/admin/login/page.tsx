'use client'

import { useState, FormEvent, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function AdminLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/admin/dashboard'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })

      if (res.status === 429) {
        setError('Too many attempts. Try again in 15 minutes.')
        return
      }

      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Invalid credentials')
        return
      }

      router.push(next)
    } catch {
      setError('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Username
        </label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          required
          className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800
                     text-white text-sm placeholder-gray-600
                     focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1.5">
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-800
                     text-white text-sm placeholder-gray-600
                     focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/50 border border-red-900
                      rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="w-full py-2 px-4 rounded-lg bg-violet-600 hover:bg-violet-500
                   text-white text-sm font-medium transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl
                          bg-violet-600 mb-4">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          <h1 className="text-xl font-semibold text-white">Ellyn Admin</h1>
          <p className="text-sm text-gray-400 mt-1">Internal access only</p>
        </div>

        <Suspense>
          <AdminLoginForm />
        </Suspense>
      </div>
    </div>
  )
}
