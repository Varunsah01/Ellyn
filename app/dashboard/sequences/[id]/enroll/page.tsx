"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertCircle, ArrowLeft, Pencil } from "lucide-react"
import { useContacts } from "@/lib/hooks/useContacts"
import { SequenceStep } from "@/lib/types/sequence"
import { EnrollmentOverrides } from "@/lib/sequence-engine"

interface SequenceDetail {
  id: string
  name: string
  description?: string | null
  steps: SequenceStep[]
}

export default function EnrollContactsPage() {
  const params = useParams()
  const router = useRouter()
  const sequenceId = params.id as string
  const { contacts, loading: contactsLoading } = useContacts({ limit: 200 })

  const [sequence, setSequence] = useState<SequenceDetail | null>(null)
  const [sequenceLoading, setSequenceLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date()
    return today.toISOString().slice(0, 10)
  })
  const [overrides, setOverrides] = useState<EnrollmentOverrides>({})
  const [customizingContactId, setCustomizingContactId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadSequence = async () => {
      try {
        setSequenceLoading(true)
        const response = await fetch(`/api/sequences/${sequenceId}`)
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to load sequence")
        }
        const data = await response.json()
        setSequence(data.sequence)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sequence")
      } finally {
        setSequenceLoading(false)
      }
    }

    loadSequence()
  }, [sequenceId])

  const selectedContactMap = useMemo(
    () => new Map(contacts.map((c) => [c.id, c])),
    [contacts]
  )

  const openCustomization = (contactId: string) => {
    setCustomizingContactId(contactId)
    setOverrides((prev) => ({ ...prev, [contactId]: prev[contactId] ?? {} }))
  }

  const updateOverride = (
    contactId: string,
    stepId: string,
    field: "subject" | "body",
    value: string
  ) => {
    setOverrides((prev) => ({
      ...prev,
      [contactId]: {
        ...(prev[contactId] ?? {}),
        [stepId]: {
          ...(prev[contactId]?.[stepId] ?? {}),
          [field]: value,
        },
      },
    }))
  }

  const toggleContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleEnroll = async () => {
    if (!sequence || selectedContacts.length === 0) return
    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/sequences/${sequenceId}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: selectedContacts,
          startDate,
          overrides,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to enroll contacts")
      }

      router.push(`/dashboard/sequences/${sequenceId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enroll contacts")
    } finally {
      setSaving(false)
    }
  }

  const customizingContact = customizingContactId
    ? selectedContactMap.get(customizingContactId)
    : null

  return (
    <DashboardShell>
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <PageHeader
          title="Enroll Contacts"
          description="Choose contacts and schedule the first send date."
        />

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>
                {sequenceLoading ? "Loading sequence..." : sequence?.name}
              </CardTitle>
              {sequence?.description ? (
                <p className="text-sm text-muted-foreground mt-1">
                  {sequence.description}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Select contacts</Label>
                {contactsLoading ? (
                  <p className="text-sm text-muted-foreground">Loading contacts...</p>
                ) : (
                  <div className="space-y-3 max-h-[420px] overflow-y-auto">
                    {contacts.map((contact) => {
                      const isSelected = selectedContacts.includes(contact.id)
                      return (
                        <div
                          key={contact.id}
                          className={`flex items-start justify-between rounded-lg border p-3 transition ${
                            isSelected ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleContact(contact.id)}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-sm font-medium">{contact.full_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {contact.company || "Unknown"} â€¢ {contact.role || "Role not set"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {contact.confirmed_email || contact.inferred_email || "No email"}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openCustomization(contact.id)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Customize
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollment Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm font-medium">
                  {selectedContacts.length} contact
                  {selectedContacts.length !== 1 ? "s" : ""} selected
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  First email goes out on {startDate}
                </p>
              </div>
              <Button
                className="w-full"
                disabled={selectedContacts.length === 0 || saving}
                onClick={handleEnroll}
              >
                {saving ? "Enrolling..." : "Enroll Contacts"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {customizingContact && sequence ? (
          <Dialog open={!!customizingContact} onOpenChange={() => setCustomizingContactId(null)}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Customize emails for {customizingContact.full_name}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {sequence.steps.map((step) => {
                  const override = overrides[customizingContact.id]?.[step.id] ?? {}
                  return (
                    <Card key={step.id}>
                      <CardHeader>
                        <CardTitle className="text-base">Step {step.order}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="space-y-2">
                          <Label>Subject</Label>
                          <Input
                            value={override.subject ?? step.subject}
                            onChange={(event) =>
                              updateOverride(
                                customizingContact.id,
                                step.id,
                                "subject",
                                event.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Body</Label>
                          <Textarea
                            value={override.body ?? step.body}
                            onChange={(event) =>
                              updateOverride(
                                customizingContact.id,
                                step.id,
                                "body",
                                event.target.value
                              )
                            }
                            className="min-h-[120px]"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </DashboardShell>
  )
}
