"use client"

import { useState } from "react"
import { formatDistanceToNow, isPast, parseISO } from "date-fns"
import { Mail, FileText, Calendar, Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { TrackerContact } from "./types"

interface ApplicationCardProps {
  contact: TrackerContact
  isDragging?: boolean
  onClick: () => void
  onEmailClick: (e: React.MouseEvent) => void
  onNotesClick: (e: React.MouseEvent) => void
}

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase() || "?"
}

function ExcitementStars({ level }: { level: number | null }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-3 w-3",
            i <= (level ?? 0)
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  )
}

export function ApplicationCard({
  contact,
  isDragging,
  onClick,
  onEmailClick,
  onNotesClick,
}: ApplicationCardProps) {
  const [hovered, setHovered] = useState(false)

  const fullName = `${contact.first_name} ${contact.last_name}`.trim()
  const initials = getInitials(contact.first_name, contact.last_name)

  const lastContacted = contact.last_contacted_at
    ? formatDistanceToNow(parseISO(contact.last_contacted_at), { addSuffix: true })
    : null

  const interviewDate = contact.interview_date ? parseISO(contact.interview_date) : null
  const interviewPast = interviewDate ? isPast(interviewDate) : false

  const tags = contact.tags ?? []
  const visibleTags = tags.slice(0, 2)
  const extraTagCount = tags.length - visibleTags.length

  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-card p-3 cursor-pointer select-none transition-all",
        "hover:border-primary/40 hover:shadow-md",
        isDragging
          ? "shadow-xl ring-2 ring-primary/50 scale-[1.03] rotate-1 z-50"
          : "shadow-sm"
      )}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header: avatar + name + company */}
      <div className="flex items-start gap-2.5 mb-2">
        <Avatar className="h-8 w-8 flex-shrink-0 ring-1 ring-border">
          <AvatarImage src={contact.avatar_url ?? undefined} alt={fullName} />
          <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight truncate">{fullName}</p>
          {contact.company_name && (
            <p className="text-xs text-muted-foreground truncate">{contact.company_name}</p>
          )}
          {contact.role && (
            <p className="text-xs text-muted-foreground/70 truncate">{contact.role}</p>
          )}
        </div>
        {contact.confidence != null && contact.confidence > 0 && (
          <Badge
            variant="outline"
            className="text-[10px] px-1 py-0 flex-shrink-0 border-emerald-200 text-emerald-700 bg-emerald-50"
          >
            {contact.confidence}%
          </Badge>
        )}
      </div>

      {/* Excitement */}
      {(contact.excitement_level ?? 0) > 0 && (
        <div className="mb-2">
          <ExcitementStars level={contact.excitement_level} />
        </div>
      )}

      {/* Interview date badge */}
      {interviewDate && (
        <div
          className={cn(
            "flex items-center gap-1 text-[11px] mb-2 rounded px-1.5 py-0.5 w-fit",
            interviewPast
              ? "bg-red-50 text-red-600 border border-red-200"
              : "bg-blue-50 text-blue-600 border border-blue-200"
          )}
        >
          <Calendar className="h-3 w-3 flex-shrink-0" />
          <span>
            {interviewPast ? "Interview was " : "Interview "}
            {formatDistanceToNow(interviewDate, { addSuffix: true })}
          </span>
        </div>
      )}

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {visibleTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 h-4"
            >
              {tag}
            </Badge>
          ))}
          {extraTagCount > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              +{extraTagCount}
            </Badge>
          )}
        </div>
      )}

      {/* Last contacted */}
      <p className="text-[11px] text-muted-foreground">
        {lastContacted ? `Contacted ${lastContacted}` : "Never contacted"}
      </p>

      {/* Hover quick actions */}
      {hovered && !isDragging && (
        <div className="absolute bottom-2 right-2 flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full bg-background shadow border"
            title="Quick email"
            onClick={onEmailClick}
          >
            <Mail className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full bg-background shadow border"
            title="Notes"
            onClick={onNotesClick}
          >
            <FileText className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}
