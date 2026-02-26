"use client"

import { useCallback, useEffect, useState } from "react"
import { Trash2, Plus, Download, Info } from "lucide-react"
import { format } from "date-fns"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Textarea } from "@/components/ui/Textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"

interface SuppressionEntry {
  id: string
  email: string
  reason: "unsubscribed" | "bounced" | "manual"
  added_at: string
}

const REASON_LABELS: Record<SuppressionEntry["reason"], string> = {
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  manual: "Manual",
}

const REASON_COLORS: Record<SuppressionEntry["reason"], string> = {
  unsubscribed: "bg-amber-50 text-amber-700 border-amber-200",
  bounced: "bg-red-50 text-red-700 border-red-200",
  manual: "bg-slate-50 text-slate-600 border-slate-200",
}

export function SuppressionListSection() {
  const [entries, setEntries] = useState<SuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Add single email dialog
  const [addOpen, setAddOpen] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addReason, setAddReason] = useState<SuppressionEntry["reason"]>("manual")
  const [addSaving, setAddSaving] = useState(false)

  // Bulk paste dialog
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkText, setBulkText] = useState("")
  const [bulkSaving, setBulkSaving] = useState(false)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await supabaseAuthedFetch("/api/v1/suppression")
      if (res.ok) {
        setEntries((await res.json()) as SuppressionEntry[])
      }
    } catch {
      showToast.error("Failed to load suppression list")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchEntries()
  }, [fetchEntries])

  const handleAdd = async () => {
    const email = addEmail.trim().toLowerCase()
    if (!email.includes("@")) {
      showToast.error("Enter a valid email address")
      return
    }
    setAddSaving(true)
    try {
      const res = await supabaseAuthedFetch("/api/v1/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, reason: addReason }),
      })
      if (!res.ok) throw new Error("Failed to add")
      showToast.success("Email added to suppression list")
      setAddEmail("")
      setAddReason("manual")
      setAddOpen(false)
      await fetchEntries()
    } catch {
      showToast.error("Failed to add email")
    } finally {
      setAddSaving(false)
    }
  }

  const handleBulkImport = async () => {
    const emails = bulkText
      .split(/[\n,;]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"))

    if (emails.length === 0) {
      showToast.error("No valid email addresses found")
      return
    }
    setBulkSaving(true)
    try {
      const res = await supabaseAuthedFetch("/api/v1/suppression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails, reason: "manual" }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = (await res.json()) as { added: number }
      showToast.success(`Added ${data.added} email${data.added !== 1 ? "s" : ""} to suppression list`)
      setBulkText("")
      setBulkOpen(false)
      await fetchEntries()
    } catch {
      showToast.error("Failed to bulk import")
    } finally {
      setBulkSaving(false)
    }
  }

  const handleRemove = async (entry: SuppressionEntry) => {
    try {
      const res = await supabaseAuthedFetch(
        `/api/v1/suppression/${encodeURIComponent(entry.email)}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed")
      setEntries((prev) => prev.filter((e) => e.id !== entry.id))
      showToast.success("Removed from suppression list")
    } catch {
      showToast.error("Failed to remove email")
    }
  }

  const emailCounts = {
    total: entries.length,
    unsubscribed: entries.filter((e) => e.reason === "unsubscribed").length,
    bounced: entries.filter((e) => e.reason === "bounced").length,
    manual: entries.filter((e) => e.reason === "manual").length,
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                Suppression List
                {emailCounts.total > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {emailCounts.total} email{emailCounts.total !== 1 ? "s" : ""}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Contacts on this list will never be included in sequences automatically.
                This helps you stay compliant and respect opt-outs.
              </CardDescription>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Bulk Import
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Email
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
            <p>
              Emails are automatically added when contacts unsubscribe from your sequences
              or when a hard bounce is detected. You can also add them manually.
            </p>
          </div>

          {/* Stats row */}
          {emailCounts.total > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Unsubscribed", count: emailCounts.unsubscribed, color: "text-amber-600" },
                { label: "Bounced", count: emailCounts.bounced, color: "text-red-600" },
                { label: "Manual", count: emailCounts.manual, color: "text-slate-600" },
              ].map(({ label, count, color }) => (
                <div key={label} className="rounded-lg border bg-card px-3 py-2">
                  <p className={`text-lg font-bold ${color}`}>{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center">
              <p className="text-sm font-medium">No suppressed emails</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Add emails you never want to contact, or they&apos;ll be added automatically when contacts opt out.
              </p>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Email
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead className="text-right">Remove</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={REASON_COLORS[entry.reason]}
                        >
                          {REASON_LABELS[entry.reason]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(entry.added_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => void handleRemove(entry)}
                          title="Remove from suppression list"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add email dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Suppression List</DialogTitle>
            <DialogDescription>
              This email will be excluded from all future sequences.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="suppress-email">Email Address</Label>
              <Input
                id="suppress-email"
                type="email"
                placeholder="contact@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {(["unsubscribed", "bounced", "manual"] as const).map((r) => (
                  <label
                    key={r}
                    className={`flex items-center justify-center rounded-md border px-2 py-1.5 text-xs cursor-pointer transition-colors ${
                      addReason === r
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={addReason === r}
                      onChange={() => setAddReason(r)}
                      className="sr-only"
                    />
                    {REASON_LABELS[r]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleAdd()} disabled={addSaving}>
              {addSaving ? "Adding…" : "Add Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Import Emails</DialogTitle>
            <DialogDescription>
              Paste a list of emails (one per line, or comma-separated).
              All will be added with reason &quot;Manual&quot;.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="bulk-emails">Email Addresses</Label>
            <Textarea
              id="bulk-emails"
              placeholder={"alice@example.com\nbob@company.com\ncarol@org.net"}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              className="min-h-[160px] font-mono text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {bulkText
                .split(/[\n,;]/)
                .map((e) => e.trim())
                .filter((e) => e.includes("@")).length}{" "}
              valid emails detected
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleBulkImport()} disabled={bulkSaving}>
              {bulkSaving ? "Importing…" : "Import Emails"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
