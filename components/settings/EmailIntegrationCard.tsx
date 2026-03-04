'use client'

import { useState } from 'react'
import { CheckCircle, Mail, AtSign, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog'
import type { IntegrationStatus } from '@/hooks/useEmailIntegrations'

interface EmailIntegrationCardProps {
  provider: 'gmail' | 'outlook'
  status: IntegrationStatus
  onConnect: () => void
  onDisconnect: () => Promise<void>
}

export function EmailIntegrationCard({
  provider,
  status,
  onConnect,
  onDisconnect,
}: EmailIntegrationCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  const label = provider === 'gmail' ? 'Gmail' : 'Outlook'
  const Icon = provider === 'gmail' ? Mail : AtSign

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await onDisconnect()
    setDisconnecting(false)
    setShowConfirm(false)
  }

  const formattedDate = status.connectedAt
    ? new Date(status.connectedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  // Loading skeleton — matches height of connected card
  if (status.loading) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border border-[#E6E4F2] bg-[#FAFAFA]">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between p-4 rounded-lg border border-[#E6E4F2] bg-[#FAFAFA]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Icon className="h-4 w-4 text-[#2D2B55]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-[#2D2B55]">{label}</p>
              {status.connected && (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              )}
            </div>
            {status.connected && status.email ? (
              <p className="text-xs text-muted-foreground">
                {status.email}
                {formattedDate && <> · Connected {formattedDate}</>}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Not connected</p>
            )}
            {status.error && (
              <p className="text-xs text-destructive">{status.error}</p>
            )}
          </div>
        </div>

        {status.connected ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowConfirm(true)}
            disabled={disconnecting}
          >
            {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Disconnect'}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={onConnect}
            className="bg-[#FF6B6B] hover:bg-[#e55f5f] text-white border-0"
          >
            Connect
          </Button>
        )}
      </div>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {label}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll no longer be able to send emails through {label} from Ellyn.
              Any active sequences using this account will be paused.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDisconnect()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
