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
  Settings2,
  UserPlus,
  Briefcase,
  CalendarDays,
  Gift,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import { usePersona } from "@/context/PersonaContext"
import { ApplicationCard } from "@/components/tracker/ApplicationCard"
import { ApplicationDetailSheet } from "@/components/tracker/ApplicationDetailSheet"
import { StageManagementSheet } from "@/components/tracker/StageManagementSheet"
import type { ApplicationStage, TrackerContact } from "@/components/tracker/types"

// ─── Stat card ───────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <div
        className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <Icon className="h-4 w-4" style={{ color }} />
      </div>
      <div>
        <p className="text-xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  )
}

// ─── Droppable Lane ──────────────────────────────────────────────────────────

interface KanbanLaneProps {
  stage: ApplicationStage
  contacts: TrackerContact[]
  isOver: boolean
  onCardClick: (c: TrackerContact) => void
  onEmailClick: (c: TrackerContact) => void
  onNotesClick: (c: TrackerContact) => void
  activeId: string | null
}

function KanbanLane({
  stage,
  contacts,
  isOver,
  onCardClick,
  onEmailClick,
  onNotesClick,
  activeId,
}: KanbanLaneProps) {
  const { setNodeRef } = useDroppable({ id: stage.id })

  return (
    <div
      className={cn(
        "flex-shrink-0 w-72 flex flex-col rounded-xl border bg-muted/30 transition-all",
        isOver && "ring-2 ring-dashed ring-primary border-primary/40 bg-primary/5"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: stage.color }}
    >
      {/* Lane header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: stage.color }}
          />
          <span className="text-sm font-semibold truncate">{stage.name}</span>
        </div>
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 flex-shrink-0">
          {contacts.length}
        </Badge>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto max-h-[calc(100vh-280px)]"
      >
        <SortableContext
          items={contacts.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence initial={false}>
            {contacts.map((contact) => (
              <SortableCard
                key={contact.id}
                contact={contact}
                onCardClick={onCardClick}
                onEmailClick={onEmailClick}
                onNotesClick={onNotesClick}
                isDraggingActive={activeId === contact.id}
              />
            ))}
          </AnimatePresence>
        </SortableContext>

        {contacts.length === 0 && !isOver && (
          <div className="flex items-center justify-center h-20 border border-dashed rounded-lg text-xs text-muted-foreground/50">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sortable card wrapper ───────────────────────────────────────────────────

interface SortableCardProps {
  contact: TrackerContact
  onCardClick: (c: TrackerContact) => void
  onEmailClick: (c: TrackerContact) => void
  onNotesClick: (c: TrackerContact) => void
  isDraggingActive: boolean
}

function SortableCard({
  contact,
  onCardClick,
  onEmailClick,
  onNotesClick,
  isDraggingActive,
}: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: contact.id })

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
      <ApplicationCard
        contact={contact}
        isDragging={isDraggingActive}
        onClick={() => onCardClick(contact)}
        onEmailClick={(e) => {
          e.stopPropagation()
          onEmailClick(contact)
        }}
        onNotesClick={(e) => {
          e.stopPropagation()
          onNotesClick(contact)
        }}
      />
    </motion.div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const router = useRouter()
  const { isJobSeeker, isLoading: personaLoading } = usePersona()

  const [stages, setStages] = useState<ApplicationStage[]>([])
  const [contacts, setContacts] = useState<TrackerContact[]>([])
  const [loading, setLoading] = useState(true)

  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const [selectedContact, setSelectedContact] = useState<TrackerContact | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Redirect non-job-seekers
  useEffect(() => {
    if (!personaLoading && !isJobSeeker) {
      router.replace("/dashboard")
    }
  }, [personaLoading, isJobSeeker, router])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [stagesRes, contactsRes] = await Promise.all([
        supabaseAuthedFetch("/api/v1/stages"),
        supabaseAuthedFetch("/api/v1/tracker"),
      ])
      if (stagesRes.ok) setStages((await stagesRes.json()) as ApplicationStage[])
      if (contactsRes.ok) setContacts((await contactsRes.json()) as TrackerContact[])
    } catch {
      showToast.error("Failed to load tracker data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!personaLoading && isJobSeeker) void fetchData()
  }, [personaLoading, isJobSeeker, fetchData])

  // Build lane map
  const contactsByStage = useMemo(() => {
    const map: Record<string, TrackerContact[]> = {}
    for (const stage of stages) map[stage.id] = []
    for (const c of contacts) {
      if (c.stage_id && map[c.stage_id]) {
        map[c.stage_id]!.push(c)
      }
    }
    return map
  }, [stages, contacts])

  // Stats
  const totalTracked = contacts.length
  const closedOrOfferIds = stages
    .filter((s) => ["closed", "offer"].some((kw) => s.name.toLowerCase().includes(kw)))
    .map((s) => s.id)
  const active = contacts.filter(
    (c) => c.stage_id && !closedOrOfferIds.includes(c.stage_id)
  ).length
  const interviews = contacts.filter((c) => c.interview_date).length
  const offerIds = stages
    .filter((s) => s.name.toLowerCase().includes("offer"))
    .map((s) => s.id)
  const offers = contacts.filter((c) => c.stage_id && offerIds.includes(c.stage_id)).length

  // ── DnD ────────────────────────────────────────────────────────────────────

  const prevStageRef = useRef<Record<string, string | null>>({})

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    const contact = contacts.find((c) => c.id === id)
    if (contact) prevStageRef.current[contact.id] = contact.stage_id
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event
    if (!over) { setOverId(null); return }
    // Check if over a stage lane or a card (resolve stage from card)
    const overId_ = String(over.id)
    const isStage = stages.some((s) => s.id === overId_)
    if (isStage) {
      setOverId(overId_)
    } else {
      const contact = contacts.find((c) => c.id === overId_)
      setOverId(contact?.stage_id ?? null)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setOverId(null)

    if (!over) return

    const contactId = String(active.id)
    const overId_ = String(over.id)

    // Determine target stage
    const isStage = stages.some((s) => s.id === overId_)
    const targetStageId = isStage
      ? overId_
      : (contacts.find((c) => c.id === overId_)?.stage_id ?? null)

    const contact = contacts.find((c) => c.id === contactId)
    if (!contact || contact.stage_id === targetStageId || !targetStageId) return

    // Optimistic update
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, stage_id: targetStageId } : c))
    )

    try {
      const res = await supabaseAuthedFetch(`/api/v1/contacts/${contactId}/stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stageId: targetStageId }),
      })
      if (!res.ok) throw new Error("Failed")
    } catch {
      // Revert
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contactId
            ? { ...c, stage_id: prevStageRef.current[contactId] ?? null }
            : c
        )
      )
      showToast.error("Failed to move card")
    }
  }

  const activeContact = activeId ? contacts.find((c) => c.id === activeId) : null

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCardClick = (c: TrackerContact) => {
    setSelectedContact(c)
    setDetailOpen(true)
  }

  const handleEmailClick = (c: TrackerContact) => {
    if (c.email) window.location.href = `mailto:${c.email}`
  }

  const handleContactUpdated = (updated: TrackerContact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setSelectedContact(updated)
  }

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (personaLoading || loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted mb-4" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (!isJobSeeker) return null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b bg-card flex-shrink-0">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "'Fraunces', serif", color: "#2D2B55" }}
            >
              Application Tracker
            </h1>
            <p className="text-sm text-muted-foreground">
              Track your job search pipeline stage by stage
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setManageOpen(true)}>
              <Settings2 className="mr-1.5 h-4 w-4" />
              Manage Stages
            </Button>
            <Button size="sm" onClick={() => router.push("/dashboard/contacts")}>
              <UserPlus className="mr-1.5 h-4 w-4" />
              Add Contact
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Total Tracked" value={totalTracked} color="#6366F1" />
          <StatCard icon={Briefcase} label="Active" value={active} color="#8B5CF6" />
          <StatCard icon={CalendarDays} label="Interviews" value={interviews} color="#F59E0B" />
          <StatCard icon={Gift} label="Offers" value={offers} color="#10B981" />
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto p-5">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={(e) => void handleDragEnd(e)}
        >
          <div className="flex gap-4 pb-4 h-full">
            {stages.map((stage) => (
              <KanbanLane
                key={stage.id}
                stage={stage}
                contacts={contactsByStage[stage.id] ?? []}
                isOver={overId === stage.id}
                onCardClick={handleCardClick}
                onEmailClick={handleEmailClick}
                onNotesClick={handleCardClick}
                activeId={activeId}
              />
            ))}

            {/* Add stage button */}
            <div className="flex-shrink-0 w-60 flex items-start pt-1">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors w-full"
                onClick={() => setManageOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add stage
              </button>
            </div>
          </div>

          {/* Drag overlay */}
          <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
            {activeContact && (
              <ApplicationCard
                contact={activeContact}
                isDragging
                onClick={() => {}}
                onEmailClick={() => {}}
                onNotesClick={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Application detail sheet */}
      <ApplicationDetailSheet
        contact={selectedContact}
        stages={stages}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false)
          setSelectedContact(null)
        }}
        onUpdated={handleContactUpdated}
      />

      {/* Stage management sheet */}
      <StageManagementSheet
        stages={stages}
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onStagesChanged={(updated) => {
          setStages(updated)
          void fetchData()
        }}
      />
    </div>
  )
}
