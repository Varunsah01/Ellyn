"use client";

import { useState, useEffect } from "react";
import { useSequences, EmailTemplate } from "@/lib/hooks/useSequences";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Mail,
  Edit2,
  Trash2,
  Copy,
  Search,
  FileText,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { EmailEditor } from "@/components/sequences/email-editor";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { TemplatePicker } from "@/components/sequences/template-picker";

export default function TemplatesPage() {
  const { templates, loading, refreshTemplates } = useSequences();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<EmailTemplate> | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Filter templates based on search
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateNew = () => {
    setEditingTemplate({
      name: "",
      subject: "",
      body: "",
    });
    setIsEditorOpen(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setIsEditorOpen(true);
  };

  const handleDuplicate = (template: EmailTemplate) => {
    setEditingTemplate({
      name: `${template.name} (Copy)`,
      subject: template.subject,
      body: template.body,
    });
    setIsEditorOpen(true);
  };

  const handleSelectFromLibrary = (template: any) => {
    setEditingTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
    });
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!editingTemplate?.name || !editingTemplate?.subject || !editingTemplate?.body) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const method = editingTemplate.id ? "PATCH" : "POST";
      const url = editingTemplate.id ? `/api/templates/${editingTemplate.id}` : "/api/templates";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTemplate),
      });

      if (!response.ok) throw new Error("Failed to save template");

      toast({
        title: editingTemplate.id ? "Template updated" : "Template created",
        description: `Successfully saved "${editingTemplate.name}"`,
      });

      setIsEditorOpen(false);
      refreshTemplates();
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not save template. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/templates/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      toast({
        title: "Template deleted",
        description: "The template has been removed.",
      });

      refreshTemplates();
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not delete template.",
        variant: "destructive",
      });
    }
  };

  return (
    <DashboardShell>
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Email Templates"
          description="Manage your email templates for outreach and follow-ups."
        >
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsPickerOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" />
              Template Library
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </div>
        </PageHeader>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted/50" />
                <CardContent className="h-32" />
              </Card>
            ))}
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="group hover:border-primary transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDuplicate(template)}
                        title="Duplicate"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(template)}
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(template.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="mt-4 line-clamp-1">{template.name}</CardTitle>
                  <CardDescription className="line-clamp-1">
                    {template.subject}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-md p-3 mb-4 h-20 overflow-hidden">
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {template.body}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <Badge variant={template.is_default ? "secondary" : "outline"}>
                      {template.is_default ? "Default" : "Custom"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="group/btn"
                      onClick={() => handleEdit(template)}
                    >
                      View Details
                      <ArrowRight className="ml-2 h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
            <FileText className="h-12 w-12 text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium">No templates found</h3>
            <p className="text-sm text-muted-foreground mb-6">
              {searchQuery ? "Try a different search term" : "Start by creating your first email template"}
            </p>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Template
            </Button>
          </div>
        )}
      </div>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate?.id ? "Edit Template" : "Create New Template"}
            </DialogTitle>
            <DialogDescription>
              Design your email template with variables for personalization.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                placeholder="e.g., Cold Outreach - Engineering"
                value={editingTemplate?.name || ""}
                onChange={(e) =>
                  setEditingTemplate((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>

            <EmailEditor
              subject={editingTemplate?.subject || ""}
              body={editingTemplate?.body || ""}
              onSubjectChange={(subject) =>
                setEditingTemplate((prev) => ({ ...prev, subject }))
              }
              onBodyChange={(body) => setEditingTemplate((prev) => ({ ...prev, body }))}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Picker Library */}
      <TemplatePicker
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelect={handleSelectFromLibrary}
      />
    </DashboardShell>
  );
}
