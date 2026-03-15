import { Copy, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/dashboard/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/Card";
import { TemplateRecord, formatDate, toToneLabel, toneBadgeClassName } from "./types";

type Props = {
  isLoading: boolean;
  templates: TemplateRecord[];
  onCreate: () => void;
  onEdit: (template: TemplateRecord) => void;
  onDuplicate: (template: TemplateRecord) => void;
  onDelete: (template: TemplateRecord) => void;
};

export function TemplatesGridSection({ isLoading, templates, onCreate, onEdit, onDuplicate, onDelete }: Props) {
  if (isLoading) {
    return <div className="text-sm text-slate-500">Loading templates...</div>;
  }

  if (!templates.length) {
    return (
      <EmptyState
        title="No templates yet"
        description="Create your first email template to reuse outreach copy across leads."
        actionLabel="Create template"
        onAction={onCreate}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <Card key={template.id} className="h-full border-slate-200 bg-white/90">
          <CardHeader className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="line-clamp-1 text-base font-semibold text-slate-900">{template.name}</CardTitle>
              <Badge variant="outline" className={toneBadgeClassName(template.tone)}>
                {toToneLabel(template.tone)}
              </Badge>
            </div>
            <CardDescription className="line-clamp-2 text-xs text-slate-500">
              Subject: {template.subject || "(No subject)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="line-clamp-5 whitespace-pre-wrap text-sm text-slate-700">{template.body}</p>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Updated {formatDate(template.updated_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(template)}>
                Edit
              </Button>
              <Button size="icon" variant="outline" onClick={() => onDuplicate(template)} aria-label="Duplicate template">
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => onDelete(template)} aria-label="Delete template">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
