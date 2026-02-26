"use client"

import { useState, useRef } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, X, Plus, RotateCcw, Check } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/Sheet"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Badge } from "@/components/ui/Badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/Dialog"
import { cn } from "@/lib/utils"
import { showToast } from "@/lib/toast"
import { supabaseAuthedFetch } from "@/lib/auth/client-fetch"
import type { ApplicationStage } from "./types"

const COLOR_PRESETS = [
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#6B7280", // gray
]

interface SortableStageRowProps {
  stage: ApplicationStage
  onNameChange: (id: string, name: string) => void
  onColorChange: (id: string, color: string) => void
  onDelete: (stage: ApplicationStage) => void
  onNameBlur: (id: string, name: string) => void
}

function SortableStageRow({
  stage,
  onNameChange,
  onColorChange,
  onDelete,
  onNameBlur,
}: SortableStageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id })

  const [showColors, setShowColors] = useState(false)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-2",
        isDragging && "opacity-50 shadow-lg z-50"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Color dot */}
      <div className="relative">
        <button
          type="button"
          className="w-5 h-5 rounded-full border-2 border-white shadow-sm flex-shrink-0"
          style={{ backgroundColor: stage.color }}
          onClick={() => setShowColors((v) => !v)}
          title="Change color"
        />
        {showColors && (
          <div className="absolute left-0 top-7 z-50 flex gap-1 bg-popover rounded-lg shadow-lg border p-2">
            {COLOR_PRESETS.map((color) => (
              <button
                key={color}
                type="button"
                className="w-5 h-5 rounded-full flex-shrink-0 ring-offset-1 hover:ring-2 hover:ring-foreground/30"
                style={{ backgroundColor: color }}
                onClick={() => {
                  onColorChange(stage.id, color)
                  setShowColors(false)
                }}
              >
                {stage.color === color && (
                  <Check className="h-3 w-3 text-white mx-auto" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Stage name */}
      <Input
        value={stage.name}
        onChange={(e) => onNameChange(stage.id, e.target.value)}
        onBlur={() => onNameBlur(stage.id, stage.name)}
        className="h-7 text-sm border-0 bg-transparent px-1 focus-visible:ring-1"
      />

      {/* Contact count */}
      {stage.contact_count > 0 && (
        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 flex-shrink-0">
          {stage.contact_count}
        </Badge>
      )}

      {/* Delete */}
      <button
        type="button"
        className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0"
        onClick={() => onDelete(stage)}
        title="Delete stage"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

interface StageManagementSheetProps {
  stages: ApplicationStage[]
  open: boolean
  onClose: () => void
  onStagesChanged: (stages: ApplicationStage[]) => void
}

export function StageManagementSheet({
  stages: initialStages,
  open,
  onClose,
  onStagesChanged,
}: StageManagementSheetProps) {
  const [stages, setStages] = useState<ApplicationStage[]>(initialStages)
  const [deleteTarget, setDeleteTarget] = useState<ApplicationStage | null>(null)
  const [newStageName, setNewStageName] = useState("")
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Keep stages in sync when prop changes (e.g. after add from parent)
  const prevOpen = useRef(open)
  if (open !== prevOpen.current) {
    prevOpen.current = open
    if (open) setStages(initialStages)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stages.findIndex((s) => s.id === active.id)
    const newIndex = stages.findIndex((s) => s.id === over.id)
    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({
      ...s,
      position: i,
    }))
    setStages(reordered)
    onStagesChanged(reordered)

    // Persist each reordered stage position
    try {
      await Promise.all(
        reordered.map((s) =>
          supabaseAuthedFetch(`/api/v1/stages/${s.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: s.position }),
          })
        )
      )
    } catch {
      showToast.error("Failed to save order")
    }
  }

  const handleNameChange = (id: string, name: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)))
  }

  const handleNameBlur = async (id: string, name: string) => {
    if (!name.trim()) return
    try {
      await supabaseAuthedFetch(`/api/v1/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const updated = stages.map((s) => (s.id === id ? { ...s, name: name.trim() } : s))
      onStagesChanged(updated)
    } catch {
      showToast.error("Failed to save")
    }
  }

  const handleColorChange = async (id: string, color: string) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)))
    try {
      await supabaseAuthedFetch(`/api/v1/stages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      })
      onStagesChanged(stages.map((s) => (s.id === id ? { ...s, color } : s)))
    } catch {
      showToast.error("Failed to save color")
    }
  }

  const handleDelete = (stage: ApplicationStage) => {
    if (stage.contact_count > 0) {
      showToast.error(
        `Move the ${stage.contact_count} contact${stage.contact_count !== 1 ? "s" : ""} out of "${stage.name}" first`
      )
      return
    }
    setDeleteTarget(stage)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await supabaseAuthedFetch(`/api/v1/stages/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed")
      const updated = stages.filter((s) => s.id !== deleteTarget.id)
      setStages(updated)
      onStagesChanged(updated)
      showToast.success(`"${deleteTarget.name}" deleted`)
    } catch {
      showToast.error("Failed to delete stage")
    } finally {
      setDeleteTarget(null)
    }
  }

  const handleAddStage = async () => {
    const name = newStageName.trim()
    if (!name) return
    try {
      const res = await supabaseAuthedFetch("/api/v1/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color: "#6366F1" }),
      })
      if (!res.ok) throw new Error("Failed")
      const newStage = (await res.json()) as ApplicationStage
      const updated = [...stages, newStage]
      setStages(updated)
      onStagesChanged(updated)
      setNewStageName("")
    } catch {
      showToast.error("Failed to add stage")
    }
  }

  const handleReset = async () => {
    try {
      // Delete all existing
      await Promise.all(
        stages.map((s) =>
          supabaseAuthedFetch(`/api/v1/stages/${s.id}`, { method: "DELETE" })
        )
      )
      // Re-fetch (will auto-seed defaults)
      const res = await supabaseAuthedFetch("/api/v1/stages")
      if (!res.ok) throw new Error("Failed")
      const fresh = (await res.json()) as ApplicationStage[]
      setStages(fresh)
      onStagesChanged(fresh)
      showToast.success("Stages reset to defaults")
    } catch {
      showToast.error("Failed to reset stages")
    } finally {
      setResetDialogOpen(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-[380px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Manage Stages</SheetTitle>
            <SheetDescription>
              Drag to reorder, click the color dot to change color, or rename inline.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-2">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={(e) => void handleDragEnd(e)}
            >
              <SortableContext
                items={stages.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {stages.map((stage) => (
                  <SortableStageRow
                    key={stage.id}
                    stage={stage}
                    onNameChange={handleNameChange}
                    onColorChange={(id, color) => void handleColorChange(id, color)}
                    onDelete={handleDelete}
                    onNameBlur={(id, name) => void handleNameBlur(id, name)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>

          {/* Add new stage */}
          <div className="flex gap-2 mt-4">
            <Input
              ref={addInputRef}
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddStage()
              }}
              placeholder="New stage name"
              className="text-sm"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void handleAddStage()}
              disabled={!newStageName.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Reset */}
          <Button
            variant="ghost"
            size="sm"
            className="mt-6 text-muted-foreground gap-1.5 w-full"
            onClick={() => setResetDialogOpen(true)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </Button>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(open: boolean) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>
              This stage will be permanently deleted. Contacts in this stage will be
              unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirmation */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to default stages?</DialogTitle>
            <DialogDescription>
              All custom stages will be deleted and replaced with the 6 default stages.
              Contacts will be unassigned.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleReset()}>Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
