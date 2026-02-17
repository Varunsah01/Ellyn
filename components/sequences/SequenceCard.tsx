"use client";

import { Sequence } from "@/lib/types/sequence";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
  MoreHorizontal,
  Play,
  Pause,
  Copy,
  Edit,
  Trash,
  Users,
  Mail,
  Eye,
  Reply,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStatusColor,
  getStatusLabel,
  calculateOpenRate,
  calculateReplyRate,
} from "@/lib/utils/sequence-utils";
import { useRouter } from "next/navigation";

interface SequenceCardProps {
  sequence: Sequence;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/**
 * Render the SequenceCard component.
 * @param {SequenceCardProps} props - Component props.
 * @returns {unknown} JSX output for SequenceCard.
 * @example
 * <SequenceCard />
 */
export function SequenceCard({
  sequence,
  onPause,
  onResume,
  onDuplicate,
  onDelete,
}: SequenceCardProps) {
  const router = useRouter();
  const statusColors = getStatusColor(sequence.status);
  const openRate = calculateOpenRate(sequence.stats);
  const replyRate = calculateReplyRate(sequence.stats);

  return (
    <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1" onClick={() => router.push(`/dashboard/sequences/${sequence.id}`)}>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                {sequence.name}
              </h3>
              <Badge
                variant="outline"
                className={cn("font-medium", statusColors.bg, statusColors.text, statusColors.border)}
              >
                {getStatusLabel(sequence.status)}
              </Badge>
            </div>
            {sequence.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {sequence.description}
              </p>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/sequences/${sequence.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/dashboard/sequences/${sequence.id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Sequence
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {sequence.status === "active" && onPause && (
                <DropdownMenuItem onClick={() => onPause(sequence.id)}>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause Sequence
                </DropdownMenuItem>
              )}
              {sequence.status === "paused" && onResume && (
                <DropdownMenuItem onClick={() => onResume(sequence.id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Resume Sequence
                </DropdownMenuItem>
              )}
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(sequence.id)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {onDelete && (
                <DropdownMenuItem
                  onClick={() => onDelete(sequence.id)}
                  className="text-destructive"
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Archive
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent onClick={() => router.push(`/dashboard/sequences/${sequence.id}`)}>
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Users className="h-3 w-3" />
              <span className="text-xs">Contacts</span>
            </div>
            <p className="text-2xl font-bold">{sequence.stats.totalContacts}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Mail className="h-3 w-3" />
              <span className="text-xs">Sent</span>
            </div>
            <p className="text-2xl font-bold">{sequence.stats.emailsSent}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Eye className="h-3 w-3" />
              <span className="text-xs">Open</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{openRate}%</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
              <Reply className="h-3 w-3" />
              <span className="text-xs">Reply</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{replyRate}%</p>
          </div>
        </div>

        {/* Progress Bar */}
        {sequence.stats.totalContacts > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{sequence.stats.inProgress} in progress</span>
              <span>{sequence.steps.length} steps</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{
                  width: `${(sequence.stats.inProgress / sequence.stats.totalContacts) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {sequence.stats.totalContacts === 0 && (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No contacts enrolled yet
          </div>
        )}
      </CardContent>
    </Card>
  );
}
