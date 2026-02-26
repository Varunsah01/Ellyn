"use client"

import { motion } from "framer-motion"
import { Copy, Edit, Zap } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card"
import { cn } from "@/lib/utils"

export type TemplateItem = {
  id: string
  name: string
  subject: string
  body: string
  use_case?: string
  category?: string
  is_system?: boolean
  is_default?: boolean
  variables?: string[]
  usage_count?: number
  tone?: string
}

interface TemplateCardProps {
  template: TemplateItem
  onUse: (t: TemplateItem) => void
  onEdit: (t: TemplateItem) => void
  onDuplicate: (t: TemplateItem) => void
}

function useCase(raw?: string) {
  if (!raw) return null
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function TemplateCard({
  template,
  onUse,
  onEdit,
  onDuplicate,
}: TemplateCardProps) {
  const isSystem = Boolean(template.is_system || template.is_default)
  const preview =
    template.body.length > 80
      ? template.body.slice(0, 80).trimEnd() + "…"
      : template.body

  return (
    <motion.div
      whileHover={{ y: -3, boxShadow: "0 8px 30px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className="rounded-xl"
    >
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-sm font-semibold leading-snug text-[#2D2B55]">
              {template.name}
            </CardTitle>
            {isSystem && (
              <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Ellyn
              </span>
            )}
          </div>
          {template.use_case && (
            <Badge
              variant="secondary"
              className="mt-1 w-fit text-[10px]"
            >
              {useCase(template.use_case)}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex-1 pb-3">
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {preview}
          </p>
        </CardContent>

        <CardFooter className="flex items-center justify-between border-t pt-3">
          <span className="text-[10px] text-muted-foreground">
            {template.usage_count
              ? `Used ${template.usage_count} time${template.usage_count === 1 ? "" : "s"}`
              : "Not used yet"}
          </span>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {isSystem ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onDuplicate(template)}
                  title="Duplicate to My Templates"
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Duplicate
                </Button>
                <Button
                  size="sm"
                  className="h-7 px-2 text-xs"
                  style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                  onClick={() => onUse(template)}
                >
                  <Zap className="mr-1 h-3 w-3" />
                  Use
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  onClick={() => onEdit(template)}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  className={cn("h-7 px-2 text-xs")}
                  style={{ backgroundColor: "#7C3AED", color: "#fff" }}
                  onClick={() => onUse(template)}
                >
                  <Zap className="mr-1 h-3 w-3" />
                  Use
                </Button>
              </>
            )}
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  )
}
