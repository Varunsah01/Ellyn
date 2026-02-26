"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/Select"
import { LOST_REASONS, type Deal, type LostReason } from "./types"

// ── Won Dialog ────────────────────────────────────────────────────────────────

interface WonDialogProps {
  deal: Deal | null
  open: boolean
  onConfirm: (finalValue: number | null, wonDate: string) => void
  onCancel: () => void
}

export function WonDialog({ deal, open, onConfirm, onCancel }: WonDialogProps) {
  const [value, setValue] = useState<string>(deal?.value?.toString() ?? "")
  const [wonDate, setWonDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  )

  const handleConfirm = () => {
    const numVal = value !== "" ? parseFloat(value) : null
    onConfirm(numVal, wonDate)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-green-600">Mark as Won 🎉</DialogTitle>
          <DialogDescription>
            Confirm the final deal value for{" "}
            <span className="font-medium">{deal?.company}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="won-value">Final Deal Value</Label>
            <div className="flex gap-2">
              <span className="flex items-center px-3 rounded-l-md border border-r-0 bg-muted text-sm text-muted-foreground">
                {deal?.currency ?? "USD"}
              </span>
              <Input
                id="won-value"
                type="number"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="rounded-l-none"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="won-date">Won Date</Label>
            <Input
              id="won-date"
              type="date"
              value={wonDate}
              onChange={(e) => setWonDate(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirm}>
            Confirm Win
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Lost Dialog ───────────────────────────────────────────────────────────────

interface LostDialogProps {
  deal: Deal | null
  open: boolean
  onConfirm: (reason: string) => void
  onCancel: () => void
}

export function LostDialog({ deal, open, onConfirm, onCancel }: LostDialogProps) {
  const [reason, setReason] = useState<LostReason | "">("")

  const handleConfirm = () => {
    if (!reason) return
    onConfirm(reason)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-600">Mark as Lost</DialogTitle>
          <DialogDescription>
            Why was{" "}
            <span className="font-medium">{deal?.company}</span>
            {" "}lost?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Lost Reason</Label>
          <Select
            value={reason}
            onValueChange={(v) => setReason(v as LostReason)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a reason…" />
            </SelectTrigger>
            <SelectContent>
              {LOST_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!reason}
            onClick={handleConfirm}
          >
            Confirm Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
