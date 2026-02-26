"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { motion, AnimatePresence } from "framer-motion"
import {
  Plus,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  TrendingUp,
  DollarSign,
  Trophy,
  Target,
} from "lucide-react"
import { format, isPast, parseISO, isThisMonth } from "date-fns"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table"
import { cn } from "@/lib/utils"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import { usePersona } from "@/context/PersonaContext"
import { DealCard } from "@/components/pipeline/DealCard"
import { DealFormDialog, type DealFormData } from "@/components/pipeline/DealFormDialog"
import { WonDialog, LostDialog } from "@/components/pipeline/WonLostDialog"
import {
  STAGE_ORDER,
  STAGE_CONFIG,
  formatCurrency,
  type Deal,
  type DealStage,
} from "@/components/pipeline/types"

// ─── helpers ─────────────────────────────────────────────────────────────────

interface ContactOption {
  id: string
  name: string
  company: string | null
}

function laneValue(deals: Deal[]): number {
  return deals.reduce((s, d) => s + (d.value ?? 0), 0)
}

function weightedValue(deals: Deal[]): number {
  return deals.reduce((s, d) => s + ((d.value ?? 0) * d.probability) / 100, 0)
}

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 min-w-0">
      <div
        className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none truncate">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Revenue panel ────────────────────────────────────────────────────────────

function RevenuePanel({ deals }: { deals: Deal[] }) {
  const wonThisMonth = deals
    .filter((d) => d.stage === "won" && d.updated_at && isThisMonth(parseISO(d.updated_at)))
    .reduce((s, d) => s + (d.value ?? 0), 0)

  const activeDeals = deals.filter((d) => d.stage !== "won" && d.stage !== "lost")
  const pipeline = laneValue(activeDeals)
  const weighted = weightedValue(activeDeals)

  const nowPlusThirty = new Date()
  nowPlusThirty.setDate(nowPlusThirty.getDate() + 30)
  const forecast = activeDeals
    .filter((d) => {
      if (!d.expected_close) return false
      const close = parseISO(d.expected_close)
      return close <= nowPlusThirty && !isPast(close)
    })
    .reduce((s, d) => s + ((d.value ?? 0) * d.probability) / 100, 0)

  const won = deals.filter((d) => d.stage === "won").length
  const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost").length
  const winRate = closed > 0 ? Math.round((won / closed) * 100) : 0

  const donutData = [
    { name: "Won", value: won, color: "#10B981" },
    { name: "Lost", value: closed - won, color: "#EF4444" },
  ]

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4 flex-shrink-0 w-72">
      <h3 className="text-sm font-semibold text-foreground">Revenue Summary</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Won this month</span>
          <span className="text-sm font-semibold text-green-600">
            {formatCurrency(wonThisMonth)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pipeline (raw)</span>
          <span className="text-sm font-medium">{formatCurrency(pipeline)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Weighted pipeline</span>
          <span className="text-sm font-medium">{formatCurrency(weighted)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">30-day forecast</span>
          <span className="text-sm font-medium text-amber-600">{formatCurrency(forecast)}</span>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-xs text-muted-foreground mb-1 text-center">Win rate</p>
        {closed > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={120}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={52}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((v: number) => [v, "Deals"]) as any}
                  contentStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-2xl font-bold text-center -mt-2">{winRate}%</p>
            <p className="text-[10px] text-muted-foreground text-center">
              {won} won / {closed - won} lost
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No closed deals yet</p>
        )}
      </div>
    </div>
  )
}

// ─── KanbanLane ───────────────────────────────────────────────────────────────

interface KanbanLaneProps {
  stage: DealStage
  deals: Deal[]
  isOver: boolean
  onCardClick: (d: Deal) => void
  activeId: string | null
}

function KanbanLane({ stage, deals, isOver, onCardClick, activeId }: KanbanLaneProps) {
  const cfg = STAGE_CONFIG[stage]
  const { setNodeRef } = useDroppable({ id: stage })
  const total = laneValue(deals)

  return (
    <div
      className={cn(
        "flex-shrink-0 w-64 flex flex-col rounded-xl border bg-muted/30 transition-all",
        isOver && "ring-2 ring-dashed ring-primary border-primary/40 bg-primary/5"
      )}
      style={{ borderTopWidth: 3, borderTopColor: cfg.color }}
    >
      {/* Lane header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className={cn("text-xs font-semibold truncate", cfg.textColor)}>
            {cfg.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {formatCurrency(total)}
            </span>
          )}
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {deals.length}
          </Badge>
        </div>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-300px)]"
      >
        <SortableContext
          items={deals.map((d) => d.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence initial={false}>
            {deals.map((deal) => (
              <SortableDealCard
                key={deal.id}
                deal={deal}
                onCardClick={onCardClick}
                isDraggingActive={activeId === deal.id}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {deals.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 border border-dashed rounded-lg text-xs text-muted-foreground/50">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SortableDealCard ─────────────────────────────────────────────────────────

function SortableDealCard({
  deal,
  onCardClick,
  isDraggingActive,
}: {
  deal: Deal
  onCardClick: (d: Deal) => void
  isDraggingActive: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: deal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      {...attributes}
      {...listeners}
    >
      <DealCard
        deal={deal}
        isDragging={isDraggingActive}
        onClick={() => onCardClick(deal)}
      />
    </motion.div>
  )
}

// ─── Sort helpers ─────────────────────────────────────────────────────────────

type SortField = "value" | "expected_close" | null
type SortDir = "asc" | "desc"

function SortIcon({ field, active, dir }: { field: SortField; active: SortField; dir: SortDir }) {
  if (field !== active) return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/50" />
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 text-primary" />
    : <ChevronDown className="h-3 w-3 text-primary" />
}

// ─── Table view ───────────────────────────────────────────────────────────────

function DealTable({
  deals,
  onEdit,
  onDelete,
}: {
  deals: Deal[]
  onEdit: (d: Deal) => void
  onDelete: (d: Deal) => void
}) {
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const sorted = useMemo(() => {
    if (!sortField) return [...deals]
    return [...deals].sort((a, b) => {
      if (sortField === "value") {
        const av = a.value ?? -1
        const bv = b.value ?? -1
        return sortDir === "asc" ? av - bv : bv - av
      }
      if (sortField === "expected_close") {
        const at = a.expected_close ? new Date(a.expected_close).getTime() : 0
        const bt = b.expected_close ? new Date(b.expected_close).getTime() : 0
        return sortDir === "asc" ? at - bt : bt - at
      }
      return 0
    })
  }, [deals, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Company</TableHead>
            <TableHead>Title</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("value")}
            >
              <div className="flex items-center gap-1">
                Value
                <SortIcon field="value" active={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Probability</TableHead>
            <TableHead
              className="cursor-pointer select-none"
              onClick={() => toggleSort("expected_close")}
            >
              <div className="flex items-center gap-1">
                Close Date
                <SortIcon field="expected_close" active={sortField} dir={sortDir} />
              </div>
            </TableHead>
            <TableHead>Contact</TableHead>
            <TableHead className="text-right pr-4">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((deal) => {
            const cfg = STAGE_CONFIG[deal.stage]
            const contactName = deal.contacts
              ? `${deal.contacts.first_name} ${deal.contacts.last_name}`.trim()
              : null
            const closeDate = deal.expected_close ? parseISO(deal.expected_close) : null
            const overdue =
              closeDate &&
              isPast(closeDate) &&
              deal.stage !== "won" &&
              deal.stage !== "lost"

            return (
              <TableRow key={deal.id}>
                <TableCell className="pl-4 font-medium">{deal.company}</TableCell>
                <TableCell className="text-muted-foreground max-w-[160px] truncate">
                  {deal.title}
                </TableCell>
                <TableCell className="font-semibold tabular-nums">
                  {formatCurrency(deal.value, deal.currency)}
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      cfg.bg,
                      cfg.textColor
                    )}
                  >
                    {cfg.label}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${deal.probability}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {deal.probability}%
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {closeDate ? (
                    <span
                      className={cn(
                        "text-xs",
                        overdue ? "text-red-500 font-medium" : "text-muted-foreground"
                      )}
                    >
                      {overdue ? "⚠ " : ""}
                      {format(closeDate, "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {contactName ?? "—"}
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onEdit(deal)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(deal)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                No deals yet. Click <strong>+ New Deal</strong> to get started.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/Dialog"

function DeleteDealDialog({
  deal,
  open,
  onCancel,
  onConfirm,
}: {
  deal: Deal | null
  open: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Deal</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-medium">{deal?.title}</span>? This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const router = useRouter()
  const { isSalesRep, isLoading: personaLoading } = usePersona()

  const [deals, setDeals] = useState<Deal[]>([])
  const [contacts, setContacts] = useState<ContactOption[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<"kanban" | "table">("kanban")

  // Dialogs
  const [formOpen, setFormOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)

  const [wonDialogDeal, setWonDialogDeal] = useState<Deal | null>(null)
  const [wonDialogOpen, setWonDialogOpen] = useState(false)
  const pendingWonRef = useRef<{ dealId: string; prevStage: DealStage } | null>(null)

  const [lostDialogDeal, setLostDialogDeal] = useState<Deal | null>(null)
  const [lostDialogOpen, setLostDialogOpen] = useState(false)
  const pendingLostRef = useRef<{ dealId: string; prevStage: DealStage } | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<Deal | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)

  // DnD state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const prevStageRef = useRef<Record<string, DealStage>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Redirect non-sales-reps
  useEffect(() => {
    if (!personaLoading && !isSalesRep) router.replace("/dashboard")
  }, [personaLoading, isSalesRep, router])

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [dealsRes, contactsRes] = await Promise.all([
        supabaseAuthedFetch("/api/v1/deals"),
        supabaseAuthedFetch("/api/v1/contacts?limit=200"),
      ])
      if (dealsRes.ok) {
        const data = (await dealsRes.json()) as Deal[]
        setDeals(data)
      }
      if (contactsRes.ok) {
        const raw = (await contactsRes.json()) as {
          contacts?: Array<{ id: string; first_name: string; last_name: string; company_name: string | null }>
          data?: Array<{ id: string; first_name: string; last_name: string; company_name: string | null }>
        }
        const list = raw.contacts ?? raw.data ?? []
        setContacts(
          list.map((c) => ({
            id: c.id,
            name: `${c.first_name} ${c.last_name}`.trim(),
            company: c.company_name,
          }))
        )
      }
    } catch {
      showToast.error("Failed to load pipeline data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!personaLoading && isSalesRep) void fetchData()
  }, [personaLoading, isSalesRep, fetchData])

  // ── Computed ────────────────────────────────────────────────────────────────

  const dealsByStage = useMemo(() => {
    const map: Record<DealStage, Deal[]> = {
      prospecting: [], contacted: [], interested: [],
      meeting: [], proposal: [], won: [], lost: [],
    }
    for (const d of deals) map[d.stage].push(d)
    return map
  }, [deals])

  const activeDeals = useMemo(
    () => deals.filter((d) => d.stage !== "won" && d.stage !== "lost"),
    [deals]
  )

  const wonThisMonth = useMemo(
    () => deals.filter(
      (d) => d.stage === "won" && d.updated_at && isThisMonth(parseISO(d.updated_at))
    ),
    [deals]
  )

  const closed = deals.filter((d) => d.stage === "won" || d.stage === "lost").length
  const wonCount = deals.filter((d) => d.stage === "won").length
  const winRate = closed > 0 ? Math.round((wonCount / closed) * 100) : 0
  const avgDealSize =
    activeDeals.length > 0
      ? activeDeals.reduce((s, d) => s + (d.value ?? 0), 0) / activeDeals.filter((d) => d.value).length || 0
      : 0

  // ── Deal CRUD ───────────────────────────────────────────────────────────────

  const handleSaveDeal = async (data: DealFormData) => {
    if (editingDeal) {
      const res = await supabaseAuthedFetch(`/api/v1/deals/${editingDeal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { showToast.error("Failed to update deal"); return }
      const updated = (await res.json()) as Deal
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      showToast.success("Deal updated")
    } else {
      const res = await supabaseAuthedFetch("/api/v1/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) { showToast.error("Failed to create deal"); return }
      const created = (await res.json()) as Deal
      setDeals((prev) => [created, ...prev])
      showToast.success("Deal created")
    }
    setEditingDeal(null)
  }

  const handleDeleteDeal = async () => {
    if (!deleteTarget) return
    const res = await supabaseAuthedFetch(`/api/v1/deals/${deleteTarget.id}`, {
      method: "DELETE",
    })
    if (!res.ok) { showToast.error("Failed to delete deal"); return }
    setDeals((prev) => prev.filter((d) => d.id !== deleteTarget.id))
    showToast.success("Deal deleted")
    setDeleteOpen(false)
    setDeleteTarget(null)
  }

  // ── Stage patching ──────────────────────────────────────────────────────────

  const patchDealStage = async (
    dealId: string,
    stage: DealStage,
    extra?: { value?: number | null; won_date?: string; lost_reason?: string }
  ) => {
    const res = await supabaseAuthedFetch(`/api/v1/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, ...extra }),
    })
    if (!res.ok) throw new Error("Failed to update stage")
    return (await res.json()) as Deal
  }

  // ── Won flow ────────────────────────────────────────────────────────────────

  const handleWonConfirm = async (finalValue: number | null, _wonDate: string) => {
    const pending = pendingWonRef.current
    if (!pending) return
    setWonDialogOpen(false)
    setWonDialogDeal(null)

    try {
      const updated = await patchDealStage(pending.dealId, "won", {
        value: finalValue,
      })
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      showToast.success("Deal marked as Won 🎉")
    } catch {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === pending.dealId ? { ...d, stage: pending.prevStage } : d
        )
      )
      showToast.error("Failed to update deal")
    }
    pendingWonRef.current = null
  }

  const handleWonCancel = () => {
    const pending = pendingWonRef.current
    if (pending) {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === pending.dealId ? { ...d, stage: pending.prevStage } : d
        )
      )
    }
    setWonDialogOpen(false)
    setWonDialogDeal(null)
    pendingWonRef.current = null
  }

  // ── Lost flow ───────────────────────────────────────────────────────────────

  const handleLostConfirm = async (reason: string) => {
    const pending = pendingLostRef.current
    if (!pending) return
    setLostDialogOpen(false)
    setLostDialogDeal(null)

    try {
      const updated = await patchDealStage(pending.dealId, "lost", {
        lost_reason: reason,
      })
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      showToast.success("Deal marked as Lost")
    } catch {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === pending.dealId ? { ...d, stage: pending.prevStage } : d
        )
      )
      showToast.error("Failed to update deal")
    }
    pendingLostRef.current = null
  }

  const handleLostCancel = () => {
    const pending = pendingLostRef.current
    if (pending) {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === pending.dealId ? { ...d, stage: pending.prevStage } : d
        )
      )
    }
    setLostDialogOpen(false)
    setLostDialogDeal(null)
    pendingLostRef.current = null
  }

  // ── DnD ────────────────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    const deal = deals.find((d) => d.id === id)
    if (deal) prevStageRef.current[id] = deal.stage
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverId(null); return }
    const overId_ = String(over.id)
    const isStage = STAGE_ORDER.includes(overId_ as DealStage)
    if (isStage) {
      setOverId(overId_)
    } else {
      const deal = deals.find((d) => d.id === overId_)
      setOverId(deal?.stage ?? null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const dealId = String(active.id)
    const overId_ = String(over.id)

    const isStage = STAGE_ORDER.includes(overId_ as DealStage)
    const targetStage = isStage
      ? (overId_ as DealStage)
      : (deals.find((d) => d.id === overId_)?.stage ?? null)

    const deal = deals.find((d) => d.id === dealId)
    if (!deal || !targetStage || deal.stage === targetStage) return

    // Optimistic move
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d)))

    if (targetStage === "won") {
      pendingWonRef.current = { dealId, prevStage: deal.stage }
      setWonDialogDeal({ ...deal, stage: targetStage })
      setWonDialogOpen(true)
      return
    }

    if (targetStage === "lost") {
      pendingLostRef.current = { dealId, prevStage: deal.stage }
      setLostDialogDeal({ ...deal, stage: targetStage })
      setLostDialogOpen(true)
      return
    }

    try {
      await patchDealStage(dealId, targetStage)
    } catch {
      setDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stage: prevStageRef.current[dealId] ?? deal.stage } : d
        )
      )
      showToast.error("Failed to move deal")
    }
  }

  const activeDeal = activeId ? deals.find((d) => d.id === activeId) : null

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (personaLoading || loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-64 h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!isSalesRep) return null

  const totalPipeline = laneValue(activeDeals)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "'Fraunces', serif", color: "#2D2B55" }}
            >
              Deal Pipeline
            </h1>
            <p className="text-sm text-muted-foreground">
              Total Pipeline:{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalPipeline)}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border bg-muted/30 p-0.5 gap-0.5">
              <Button
                variant={view === "kanban" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5"
                onClick={() => setView("kanban")}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Kanban
              </Button>
              <Button
                variant={view === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5"
                onClick={() => setView("table")}
              >
                <List className="h-3.5 w-3.5 mr-1" />
                Table
              </Button>
            </div>

            <Button
              size="sm"
              onClick={() => {
                setEditingDeal(null)
                setFormOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              New Deal
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            icon={Target}
            label="Active Deals"
            value={String(activeDeals.length)}
            color="#6366F1"
          />
          <StatCard
            icon={Trophy}
            label="Won This Month"
            value={formatCurrency(wonThisMonth.reduce((s, d) => s + (d.value ?? 0), 0))}
            sub={`${wonThisMonth.length} deal${wonThisMonth.length !== 1 ? "s" : ""}`}
            color="#10B981"
          />
          <StatCard
            icon={TrendingUp}
            label="Win Rate"
            value={`${winRate}%`}
            sub={`${wonCount} / ${closed} closed`}
            color="#F59E0B"
          />
          <StatCard
            icon={DollarSign}
            label="Avg Deal Size"
            value={formatCurrency(isFinite(avgDealSize) ? Math.round(avgDealSize) : 0)}
            sub="active deals"
            color="#8B5CF6"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {view === "kanban" ? (
          <div className="flex h-full gap-4 p-5 overflow-x-auto">
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={(e) => void handleDragEnd(e)}
            >
              <div className="flex gap-4 pb-4 h-full">
                {STAGE_ORDER.map((stage) => (
                  <KanbanLane
                    key={stage}
                    stage={stage}
                    deals={dealsByStage[stage]}
                    isOver={overId === stage}
                    onCardClick={(d) => {
                      setEditingDeal(d)
                      setFormOpen(true)
                    }}
                    activeId={activeId}
                  />
                ))}

                {/* Add deal button */}
                <div className="flex-shrink-0 w-52 flex items-start pt-1">
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors w-full"
                    onClick={() => {
                      setEditingDeal(null)
                      setFormOpen(true)
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add deal
                  </button>
                </div>
              </div>

              <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
                {activeDeal && (
                  <DealCard deal={activeDeal} isDragging onClick={() => {}} />
                )}
              </DragOverlay>
            </DndContext>

            {/* Revenue panel — fixed right side */}
            <div className="flex-shrink-0 self-start sticky top-0">
              <RevenuePanel deals={deals} />
            </div>
          </div>
        ) : (
          <div className="p-5 flex gap-5 overflow-auto h-full">
            <div className="flex-1 min-w-0">
              <DealTable
                deals={deals}
                onEdit={(d) => {
                  setEditingDeal(d)
                  setFormOpen(true)
                }}
                onDelete={(d) => {
                  setDeleteTarget(d)
                  setDeleteOpen(true)
                }}
              />
            </div>
            <div className="flex-shrink-0 self-start sticky top-0">
              <RevenuePanel deals={deals} />
            </div>
          </div>
        )}
      </div>

      {/* Deal form */}
      <DealFormDialog
        deal={editingDeal}
        open={formOpen}
        contacts={contacts}
        onClose={() => {
          setFormOpen(false)
          setEditingDeal(null)
        }}
        onSave={handleSaveDeal}
      />

      {/* Won dialog */}
      <WonDialog
        deal={wonDialogDeal}
        open={wonDialogOpen}
        onConfirm={(finalValue, wonDate) => void handleWonConfirm(finalValue, wonDate)}
        onCancel={handleWonCancel}
      />

      {/* Lost dialog */}
      <LostDialog
        deal={lostDialogDeal}
        open={lostDialogOpen}
        onConfirm={(reason) => void handleLostConfirm(reason)}
        onCancel={handleLostCancel}
      />

      {/* Delete dialog */}
      <DeleteDealDialog
        deal={deleteTarget}
        open={deleteOpen}
        onCancel={() => {
          setDeleteOpen(false)
          setDeleteTarget(null)
        }}
        onConfirm={() => void handleDeleteDeal()}
      />
    </div>
  )
}
