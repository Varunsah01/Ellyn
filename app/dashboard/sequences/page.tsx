"use client"

import { useCallback, useEffect, useState } from "react"
import { DashboardShell } from "@/components/dashboard/DashboardShell"
import { PageHeader } from "@/components/dashboard/PageHeader"
import { Button } from "@/components/ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { SequenceCard } from "@/components/sequences/SequenceCard"
import { buildGmailLink, buildOutlookLink } from "@/lib/sequence-engine"
import { Sequence } from "@/lib/types/sequence"
import { AlertCircle, CalendarCheck, FileText, Info, Mail, RefreshCw } from "lucide-react"
import Link from "next/link"

interface DigestItem {
  enrollmentStepId: string
  sequenceId: string
  sequenceName: string
  contactName: string
  contactEmail: string
  subject: string
  body: string
  scheduledFor: string
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [digest, setDigest] = useState<DigestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const [sequencesRes, digestRes] = await Promise.all([
        fetch("/api/v1/sequences"),
        fetch("/api/v1/sequences/execute"),
      ])

      if (!sequencesRes.ok) {
        const data = await sequencesRes.json()
        throw new Error(data.error || "Failed to load sequences")
      }

      const sequencesData = await sequencesRes.json()
      const digestData = digestRes.ok ? await digestRes.json() : { items: [] }

      setSequences(sequencesData.sequences || [])
      setDigest(digestData.items || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sequences")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMarkSent = async (enrollmentStepId: string) => {
    await fetch("/api/v1/sequences/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_sent", enrollmentStepId }),
    })
    fetchData()
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Sequences"
        description="Automate follow-ups and track performance"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button asChild>
              <Link href="/dashboard/sequences/create">
                <Mail className="mr-2 h-4 w-4" />
                Create Sequence
              </Link>
            </Button>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive flex items-center gap-2 mb-6">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <Card className="mb-6 border-blue-200/80 bg-blue-50/40">
        <CardContent className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 text-blue-700" />
            <div>
              <p className="text-sm font-medium text-slate-900">How sequences work</p>
              <p className="text-sm text-slate-600">
                Create a sequence, enroll contacts, then use today's digest to send and mark steps complete.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/templates">
                <FileText className="mr-2 h-4 w-4" />
                Open Templates
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/dashboard/sequences/create">Create Sequence</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Today&apos;s emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            {digest.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium text-slate-900">No emails scheduled for today</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Enroll contacts in a sequence to populate this daily send list.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {digest.map((item) => (
                  <div key={item.enrollmentStepId} className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{item.contactName}</p>
                        <p className="text-xs text-muted-foreground">{item.contactEmail}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {item.sequenceName}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.scheduledFor).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm mt-3">{item.subject}</p>
                    <div className="mt-2">
                      <Badge variant="outline" className="text-[11px]">
                        Ready to send
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a
                          href={buildGmailLink({
                            to: item.contactEmail,
                            subject: item.subject,
                            body: item.body,
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Gmail
                        </a>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a
                          href={buildOutlookLink({
                            to: item.contactEmail,
                            subject: item.subject,
                            body: item.body,
                          })}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open in Outlook
                        </a>
                      </Button>
                      <Button size="sm" onClick={() => handleMarkSent(item.enrollmentStepId)}>
                        Mark Sent
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sequence Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading sequences...</p>
            ) : sequences.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium text-slate-900">No sequences yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a sequence to automate follow-ups and track outcomes.
                </p>
                <Button className="mt-3" size="sm" asChild>
                  <Link href="/dashboard/sequences/create">Create Sequence</Link>
                </Button>
              </div>
            ) : (
              sequences.map((sequence) => (
                <SequenceCard key={sequence.id} sequence={sequence} />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}

