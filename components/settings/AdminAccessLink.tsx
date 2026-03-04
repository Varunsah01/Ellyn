'use client'

import Link from 'next/link'
import { Shield } from 'lucide-react'

export function AdminAccessLink() {
  return (
    <div className="pt-4 border-t border-border">
      <Link
        href="/admin/dashboard"
        className="inline-flex items-center gap-2 text-xs text-muted-foreground
                   hover:text-[#2D2B55] transition-colors"
      >
        <Shield className="h-3.5 w-3.5" />
        Admin Dashboard
      </Link>
    </div>
  )
}
