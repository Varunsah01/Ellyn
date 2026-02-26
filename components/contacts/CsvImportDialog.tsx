"use client"

import { useCallback, useRef, useState } from "react"
import Papa from "papaparse"
import { Upload, ChevronRight, Download, CheckCircle2, AlertCircle, X, FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/Dialog"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Progress } from "@/components/ui/Progress"
import { cn } from "@/lib/utils"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"

// ─── Field definitions ────────────────────────────────────────────────────────

const ELLYN_FIELDS = [
  { key: "first_name", label: "First Name", required: true },
  { key: "last_name", label: "Last Name", required: true },
  { key: "company", label: "Company", required: true },
  { key: "role", label: "Role", required: false },
  { key: "email", label: "Email", required: false },
  { key: "linkedin_url", label: "LinkedIn URL", required: false },
  { key: "location", label: "Location", required: false },
  { key: "tags", label: "Tags", required: false },
  { key: "notes", label: "Notes", required: false },
] as const

type EllynFieldKey = (typeof ELLYN_FIELDS)[number]["key"]

const KNOWN_ALIASES: Record<string, EllynFieldKey> = {
  // first_name
  first_name: "first_name",
  firstname: "first_name",
  "first name": "first_name",
  given_name: "first_name",
  givenname: "first_name",
  // last_name
  last_name: "last_name",
  lastname: "last_name",
  "last name": "last_name",
  surname: "last_name",
  family_name: "last_name",
  // company
  company: "company",
  company_name: "company",
  "company name": "company",
  organization: "company",
  org: "company",
  // role
  role: "role",
  title: "role",
  "job title": "role",
  job_title: "role",
  position: "role",
  // email
  email: "email",
  "email address": "email",
  email_address: "email",
  "work email": "email",
  // linkedin_url
  linkedin_url: "linkedin_url",
  linkedin: "linkedin_url",
  "linkedin url": "linkedin_url",
  "linkedin profile": "linkedin_url",
  // location
  location: "location",
  city: "location",
  country: "location",
  // tags
  tags: "tags",
  labels: "tags",
  categories: "tags",
  // notes
  notes: "notes",
  note: "notes",
  comments: "notes",
  comment: "notes",
}

function autoDetectMapping(header: string): EllynFieldKey | "" {
  const normalized = header.trim().toLowerCase().replace(/[-_\s]+/g, " ").replace(/ /g, "_")
  // Try normalized with underscores
  const withUnderscore = header.trim().toLowerCase().replace(/[\s-]+/g, "_")
  return (
    KNOWN_ALIASES[header.trim().toLowerCase()] ??
    KNOWN_ALIASES[withUnderscore] ??
    KNOWN_ALIASES[normalized] ??
    ""
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

interface ParsedFile {
  name: string
  rows: Record<string, string>[]
  headers: string[]
}

interface MappingState {
  [csvHeader: string]: EllynFieldKey | ""
}

interface ImportResult {
  imported: number
  skipped: number
  errors: { row: number; reason: string }[]
}

interface CsvImportDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepIndicator({ step, current }: { step: number; current: Step }) {
  const done = step < current
  const active = step === current
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "h-6 w-6 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
          done && "bg-primary text-primary-foreground",
          active && "bg-primary/20 text-primary ring-2 ring-primary/40",
          !done && !active && "bg-muted text-muted-foreground"
        )}
      >
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
      </div>
      <span
        className={cn(
          "text-xs font-medium",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {step === 1 ? "Upload" : step === 2 ? "Map Fields" : "Import"}
      </span>
    </div>
  )
}

// ─── CSV row to contact input ─────────────────────────────────────────────────

function rowToContact(row: Record<string, string>, mapping: MappingState) {
  const mapped: Record<string, string> = {}
  for (const [csvHeader, ellynField] of Object.entries(mapping)) {
    if (!ellynField) continue
    const val = row[csvHeader]?.trim() ?? ""
    if (val) mapped[ellynField] = val
  }
  return {
    first_name: mapped.first_name ?? "",
    last_name: mapped.last_name ?? "",
    company: mapped.company ?? "",
    role: mapped.role ?? null,
    email: mapped.email ?? null,
    linkedin_url: mapped.linkedin_url ?? null,
    location: mapped.location ?? null,
    tags: mapped.tags
      ? mapped.tags.split(/[,;|]/).map((t) => t.trim()).filter(Boolean)
      : null,
    notes: mapped.notes ?? null,
  }
}

function isValidRow(contact: ReturnType<typeof rowToContact>) {
  return Boolean(contact.first_name && contact.last_name && contact.company)
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CsvImportDialog({ open, onClose, onSuccess }: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>(1)
  const [dragging, setDragging] = useState(false)
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null)
  const [mapping, setMapping] = useState<MappingState>({})
  const [skipUnmapped, setSkipUnmapped] = useState(true)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep(1)
    setDragging(false)
    setParsedFile(null)
    setMapping({})
    setSkipUnmapped(true)
    setImportResult(null)
    setImporting(false)
    setImportProgress(0)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  // ── File parsing ────────────────────────────────────────────────────────────

  const parseFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      showToast.error("Please upload a .csv file")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast.error("File must be under 5 MB")
      return
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields ?? []
        const rows = results.data as Record<string, string>[]

        if (headers.length === 0 || rows.length === 0) {
          showToast.error("CSV appears to be empty")
          return
        }

        // Auto-detect mapping
        const autoMapping: MappingState = {}
        for (const h of headers) {
          autoMapping[h] = autoDetectMapping(h)
        }

        setParsedFile({ name: file.name, rows, headers })
        setMapping(autoMapping)
      },
      error: () => {
        showToast.error("Failed to parse CSV file")
      },
    })
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }

  // ── Validation preview ──────────────────────────────────────────────────────

  const { validCount, invalidCount } = (() => {
    if (!parsedFile) return { validCount: 0, invalidCount: 0 }
    let valid = 0
    let invalid = 0
    for (const row of parsedFile.rows) {
      if (isValidRow(rowToContact(row, mapping))) valid++
      else invalid++
    }
    return { validCount: valid, invalidCount: invalid }
  })()

  // ── Import ──────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    if (!parsedFile) return
    setImporting(true)
    setImportProgress(0)

    const contacts = parsedFile.rows
      .map((row) => rowToContact(row, mapping))
      .filter(isValidRow)

    const BATCH = 50
    const result: ImportResult = { imported: 0, skipped: 0, errors: [] }

    for (let i = 0; i < contacts.length; i += BATCH) {
      const chunk = contacts.slice(i, i + BATCH)
      try {
        const res = await supabaseAuthedFetch("/api/v1/contacts/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contacts: chunk }),
        })
        if (res.ok) {
          const data = (await res.json()) as ImportResult
          result.imported += data.imported
          result.skipped += data.skipped
          result.errors.push(...data.errors)
        } else {
          result.errors.push({
            row: i + 1,
            reason: `Batch failed (HTTP ${res.status})`,
          })
        }
      } catch {
        result.errors.push({ row: i + 1, reason: "Network error" })
      }
      setImportProgress(Math.round(((i + BATCH) / contacts.length) * 100))
    }

    setImportProgress(100)
    setImportResult(result)
    setImporting(false)

    if (result.imported > 0) {
      showToast.success(
        `Imported ${result.imported} contact${result.imported !== 1 ? "s" : ""}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`
      )
    }
  }

  // ── Download skipped CSV ────────────────────────────────────────────────────

  const downloadSkipped = () => {
    if (!parsedFile || !importResult) return
    const errorRows = new Set(importResult.errors.map((e) => e.row - 1))
    const headers = parsedFile.headers

    const skippedData = parsedFile.rows.filter((_, i) => {
      const contact = rowToContact(parsedFile.rows[i]!, mapping)
      return !isValidRow(contact) || errorRows.has(i)
    })

    const csv = [
      headers.join(","),
      ...skippedData.map((row) =>
        headers.map((h) => `"${(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `skipped_contacts_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-5 pb-4 border-b">
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-4 mt-2">
            <StepIndicator step={1} current={step} />
            <div className="h-px flex-1 bg-border" />
            <StepIndicator step={2} current={step} />
            <div className="h-px flex-1 bg-border" />
            <StepIndicator step={3} current={step} />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── STEP 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer",
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={onFileChange}
                />
                <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
                <p className="text-sm font-medium">Drag &amp; drop your CSV here</p>
                <p className="text-xs text-muted-foreground mt-1">
                  or{" "}
                  <span className="text-primary font-medium">browse</span>
                  {" "}— .csv only, max 5 MB
                </p>
              </div>

              {/* File info */}
              {parsedFile && (
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{parsedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {parsedFile.rows.length.toLocaleString()} rows detected
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation()
                        setParsedFile(null)
                        setMapping({})
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Preview table */}
              {parsedFile && parsedFile.rows.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Preview (first 3 rows)
                  </p>
                  <div className="overflow-x-auto rounded-lg border text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          {parsedFile.headers.map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsedFile.rows.slice(0, 3).map((row, i) => (
                          <tr key={i} className="border-t">
                            {parsedFile.headers.map((h) => (
                              <td key={h} className="px-3 py-2 text-muted-foreground truncate max-w-[140px]">
                                {row[h] ?? ""}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: Map Fields ── */}
          {step === 2 && parsedFile && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Match your CSV columns to Ellyn fields. Required fields are marked with{" "}
                <span className="text-destructive">*</span>.
              </p>

              <div className="space-y-2">
                {parsedFile.headers.map((header) => {
                  const currentValue = mapping[header] ?? ""
                  return (
                    <div
                      key={header}
                      className="grid grid-cols-2 gap-3 items-center rounded-lg border bg-card px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium truncate">{header}</span>
                        {currentValue && (
                          <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                            auto
                          </Badge>
                        )}
                      </div>
                      <select
                        value={currentValue}
                        onChange={(e) =>
                          setMapping((m) => ({
                            ...m,
                            [header]: e.target.value as EllynFieldKey | "",
                          }))
                        }
                        className="h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">— Skip —</option>
                        {ELLYN_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                            {f.required ? " *" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>

              {/* Skip unmapped toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipUnmapped}
                  onChange={(e) => setSkipUnmapped(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-muted-foreground">
                  Skip rows with unmapped required fields
                </span>
              </label>

              {/* Row validation preview */}
              <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">
                    <span className="font-semibold">{validCount}</span> rows will import
                  </span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span className="text-sm">
                      <span className="font-semibold">{invalidCount}</span> rows will be skipped
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 3: Import ── */}
          {step === 3 && (
            <div className="space-y-5">
              {!importResult && !importing && (
                <div className="text-center py-4">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/60" />
                  <p className="text-base font-medium">
                    Ready to import {validCount} contact{validCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This will add them to your contacts list. Duplicates are automatically skipped.
                  </p>
                </div>
              )}

              {importing && (
                <div className="space-y-3 py-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Importing…</span>
                    <span className="font-medium">{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {importResult && (
                <div className="space-y-4">
                  {/* Summary card */}
                  <div
                    className={cn(
                      "rounded-xl border p-5",
                      importResult.imported > 0 ? "bg-green-50 border-green-200" : "bg-muted"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle2
                        className={cn(
                          "h-6 w-6 flex-shrink-0 mt-0.5",
                          importResult.imported > 0 ? "text-green-600" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="font-semibold text-base">
                          Imported {importResult.imported} of {parsedFile?.rows.length ?? 0} contacts
                        </p>
                        {importResult.skipped > 0 && (
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {importResult.skipped} skipped (duplicates or missing required fields)
                          </p>
                        )}
                        {importResult.errors.length > 0 && (
                          <p className="text-sm text-destructive mt-0.5">
                            {importResult.errors.length} error{importResult.errors.length !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Error list */}
                  {importResult.errors.length > 0 && (
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {importResult.errors.slice(0, 10).map((e, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3 flex-shrink-0" />
                          <span>Row {e.row}: {e.reason}</span>
                        </div>
                      ))}
                      {importResult.errors.length > 10 && (
                        <p className="text-xs text-muted-foreground">
                          …and {importResult.errors.length - 10} more
                        </p>
                      )}
                    </div>
                  )}

                  {/* Download skipped */}
                  {(importResult.skipped > 0 || importResult.errors.length > 0) && (
                    <Button variant="outline" size="sm" onClick={downloadSkipped}>
                      <Download className="mr-2 h-3.5 w-3.5" />
                      Download skipped rows as CSV
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 border-t px-6 py-3 flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {step > 1 && !importResult && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep((s) => (s - 1) as Step)}
                disabled={importing}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleClose} disabled={importing}>
              {importResult ? "Close" : "Cancel"}
            </Button>

            {step === 1 && (
              <Button
                disabled={!parsedFile}
                onClick={() => setStep(2)}
              >
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}

            {step === 2 && (
              <Button
                disabled={validCount === 0}
                onClick={() => setStep(3)}
              >
                Next
                <ChevronRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}

            {step === 3 && !importResult && (
              <Button
                disabled={importing || validCount === 0}
                onClick={() => void handleImport()}
              >
                {importing ? "Importing…" : `Import ${validCount} Contact${validCount !== 1 ? "s" : ""}`}
              </Button>
            )}

            {step === 3 && importResult && (
              <Button
                onClick={() => {
                  onSuccess()
                  handleClose()
                }}
              >
                View Contacts
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
