'use client'

import { useRouter } from 'next/navigation'

export function AdminLogoutButton() {
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin-auth/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  return (
    <button
      onClick={logout}
      className="text-xs text-gray-500 hover:text-red-400 transition-colors"
    >
      Sign out
    </button>
  )
}
