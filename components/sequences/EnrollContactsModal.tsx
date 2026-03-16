"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  Mail,
  Search,
  ShieldOff,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog"
import { Switch } from "@/components/ui/Switch"
import { Label } from "@/components/ui/Label"
import { showToast } from "@/lib/toast"
import { useContacts } from "@/lib/hooks/useContacts"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import { cn } from "@/lib/utils"
import { useEmailIntegrations } from "@/hooks/useEmailIntegrations"

const STATUS_BADGE: Record<string, string> = {
  new: "border-slate-200 bg-slate-50 text-slate-600",
  contacted: "border-blue-200 bg-blue-50 text-blue-700",
  replied: "border-green-200 bg-green-50 text-green-700",
  no_response: "border-amber-200 bg-amber-50 text-amber-700",
}

interface EnrollContactsModalProps {
  sequenceId: string
  trigger: React.ReactNode
  onSuccess?: () => void
}

export function EnrollContactsModal({
  sequenceId,
  trigger,
  onSuccess,
}: EnrollContactsModalProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [uncontactedOnly, setUncontactedOnly] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [enrolling, setEnrolling] = useState(false)
  const [suppressedEmails, setSuppressedEmails] = useState<Set<string>>(new Set())

  const { gmail, outlook } = useEmailIntegrations()
  const hasEmailConnected = gmail.connected || outlook.connected
  const emailCheckLoading = gmail.loading || outlook.loading

  const { contacts, loading } = useContacts({
    limit: 200,
    autoRefresh: false,
  })

  // Fetch suppression list when dialog opens
  useEffect(() => {
    if (!open) return
    void supabaseAuthedFetch("/api/v1/suppression")
      .then((res) => res.json())
      .then((data: { email: string }[]) => {
        setSuppressedEmails(new Set(data.map((e) => e.email)))
      })
      .catch(() => {
        // Non-fatal — proceed without suppression check
      })
  }, [open])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch("")
      setSelected(new Set())
      setUncontactedOnly(true)
      setSuppressedEmails(new Set())
    }
  }, [open])

  const filtered = useMemo(() => {
    let list = contacts
    if (uncontactedOnly) {
      list = list.filter((c) => c.status === "new")
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          (c.company ?? "").toLowerCase().includes(q) ||
          (c.confirmed_email ?? c.inferred_email ?? "")
            .toLowerCase()
            .includes(q)
      )
    }
    return list
  }, [contacts, search, uncontactedOnly])

  const enrollableFiltered = useMemo(
    () =>
      filtered.filter((c) => {
        const email = c.confirmed_email ?? c.inferred_email
        return !email || !suppressedEmails.has(email)
      }),
    [filtered, suppressedEmails]
  )

  const allFilteredSelected =
    enrollableFiltered.length > 0 &&
    enrollableFiltered.every((c) => selected.has(c.id))

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        enrollableFiltered.forEach((c) => next.delete(c.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        enrollableFiltered.forEach((c) => next.add(c.id))
        return next
      })
    }
  }

  const toggle = (id: string, suppressed: boolean) => {
    if (suppressed) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleEnroll = async () => {
    if (selected.size === 0) return
    setEnrolling(true)
    try {
      const startDate = new Date().toISOString().slice(0, 10)
      const res = await fetch(`/api/v1/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: Array.from(selected),
          startDate,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        throw new Error(data?.error ?? "Enrollment failed")
      }
      showToast.success(
        `${selected.size} contact${selected.size !== 1 ? "s" : ""} enrolled`
      )
      setOpen(false)
      onSuccess?.()
    } catch (err) {
      showToast.error(
        err instanceof Error ? err.message : "Enrollment failed"
      )
    } finally {
      setEnrolling(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85vh] max-w-xl flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Enroll Contacts
          </DialogTitle>
        </DialogHeader>

        {/* Email connection gate */}
        {!emailCheckLoading && !hasEmailConnected && (
          <div className="flex-shrink-0 border-b px-5 py-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
                <Lock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Connect an Email Account to Enroll
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Bulk enrollment requires a connected Gmail or Outlook account so
                  Ellyn can send emails on your behalf.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOpen(false)
                  window.location.href = "/dashboard/settings"
                }}
              >
                <Mail className="mr-2 h-4 w-4" />
                Connect Email Account
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className={cn("flex-shrink-0 space-y-3 border-b px-5 py-3", !hasEmailConnected && !emailCheckLoading && "pointer-events-none opacity-40")}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 text-sm"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="uncontacted-toggle"
                checked={uncontactedOnly}
                onCheckedChange={setUncontactedOnly}
              />
              <Label
                htmlFor="uncontacted-toggle"
                className="cursor-pointer text-sm"
              >
                Uncontacted only
              </Label>
            </div>
            {enrollableFiltered.length > 0 && (
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-violet-600 hover:underline"
              >
                {allFilteredSelected
                  ? "Deselect all"
                  : `Select all (${enrollableFiltered.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Contact list */}
        <div className={cn("flex-1 overflow-y-auto px-2 py-1", !hasEmailConnected && !emailCheckLoading && "pointer-events-none opacity-40")}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              {search || uncontactedOnly
                ? "No contacts match your filters"
                : "No contacts yet"}
            </div>
          ) : (
            <div className="space-y-0.5">
              {filtered.map((contact) => {
                const email =
                  contact.confirmed_email ?? contact.inferred_email
                const hasEmail = Boolean(email)
                const isVerified = contact.email_verified === true
                const isSuppressed = Boolean(
                  email && suppressedEmails.has(email)
                )
                const isSelected = !isSuppressed && selected.has(contact.id)

                return (
                  <div
                    key={contact.id}
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-disabled={isSuppressed}
                    tabIndex={isSuppressed ? -1 : 0}
                    onClick={() => toggle(contact.id, isSuppressed)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && toggle(contact.id, isSuppressed)
                    }
                    title={
                      isSuppressed
                        ? "This contact has unsubscribed and won't be enrolled"
                        : undefined
                    }
                    className={cn(
                      "flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSuppressed
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer",
                      !isSuppressed &&
                        (isSelected
                          ? "bg-violet-50 ring-1 ring-inset ring-violet-200"
                          : "hover:bg-muted/50")
                    )}
                  >
                    {/* Custom checkbox */}
                    <div className="mt-0.5 flex-shrink-0">
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border-2 transition-colors",
                          isSuppressed
                            ? "border-muted-foreground/20 bg-muted/30"
                            : isSelected
                            ? "border-violet-600 bg-violet-600"
                            : "border-muted-foreground/40 bg-background"
                        )}
                      >
                        {isSelected && (
                          <Check className="h-2.5 w-2.5 text-white" />
                        )}
                      </div>
                    </div>

                    {/* Contact info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {contact.full_name}
                        </span>
                        {isSuppressed ? (
                          <Badge
                            variant="outline"
                            className="flex-shrink-0 px-1.5 h-4 text-[10px] border-slate-200 bg-slate-50 text-slate-500 flex items-center gap-0.5"
                          >
                            <ShieldOff className="h-2.5 w-2.5" />
                            Suppressed
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "flex-shrink-0 px-1.5 h-4 text-[10px]",
                              STATUS_BADGE[contact.status] ??
                                STATUS_BADGE.new
                            )}
                          >
                            {contact.status.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        {contact.company && (
                          <span className="truncate">{contact.company}</span>
                        )}
                        {contact.company && (email || !hasEmail) && (
                          <span>·</span>
                        )}
                        {email ? (
                          <span className="truncate font-mono">{email}</span>
                        ) : (
                          <span
                            className="flex items-center gap-0.5 text-amber-600"
                            title="This contact has no email — they'll be skipped during sending"
                          >
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            No email
                          </span>
                        )}
                        {hasEmail && !isVerified && !isSuppressed && (
                          <span title="Email not verified — may bounce">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0 text-amber-500" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 items-center border-t px-5 py-3">
          {selected.size > 0 && (
            <span className="mr-auto text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {selected.size}
              </span>{" "}
              selected
            </span>
          )}
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={enrolling}
          >
            Cancel
          </Button>
          <Button
            disabled={selected.size === 0 || enrolling || !hasEmailConnected}
            style={{ backgroundColor: "#7C3AED", color: "#fff" }}
            onClick={() => void handleEnroll()}
          >
            {enrolling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enrolling…
              </>
            ) : (
              <>
                <Users className="mr-2 h-4 w-4" />
                Enroll {selected.size > 0 ? selected.size : ""} Contact
                {selected.size !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
