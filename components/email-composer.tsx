"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { replaceTemplateVariables } from "@/lib/gmail-helper";
import type { Lead } from "@/lib/supabase";

const formSchema = z.object({
  to: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(10, "Email body must be at least 10 characters"),
});

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export function EmailComposer({ open, onOpenChange, lead }: EmailComposerProps) {
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      to: lead?.selected_email || "",
      subject: "",
      body: "",
    },
  });

  // Load templates
  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch("/api/email-templates");
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (error) {
        console.error("Error loading templates:", error);
      }
    }
    loadTemplates();
  }, []);

  // Update form when lead changes
  useEffect(() => {
    if (lead?.selected_email) {
      form.setValue("to", lead.selected_email);
    }
  }, [lead, form]);

  function handleTemplateSelect(templateId: string) {
    setSelectedTemplate(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (!template || !lead) return;

    // Replace template variables
    const variables = {
      firstName: lead.person_name.split(" ")[0],
      lastName: lead.person_name.split(" ").slice(1).join(" "),
      company: lead.company_name,
      yourName: "Your Name", // User should customize this
      industry: "your industry", // User should customize this
    };

    const subject = replaceTemplateVariables(template.subject, variables);
    const body = replaceTemplateVariables(template.body, variables);

    form.setValue("subject", subject);
    form.setValue("body", body);
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!lead) return;

    setIsSending(true);
    try {
      const response = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          to: values.to,
          subject: values.subject,
          body: values.body,
          isHtml: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send email");
      }

      toast({
        title: "Email Sent!",
        description: `Email sent successfully to ${values.to}`,
      });

      form.reset();
      onOpenChange(false);

      // Trigger a refresh of the leads table
      window.dispatchEvent(new CustomEvent("lead-updated"));
    } catch (error: any) {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send email. Check your Gmail connection.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
          <DialogDescription>
            Compose and send an email to {lead?.person_name}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Template Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Template</label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select a template to auto-fill subject and body
              </p>
            </div>

            {/* To Field */}
            <FormField
              control={form.control}
              name="to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>To</FormLabel>
                  <FormControl>
                    <Input placeholder="recipient@company.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Subject Field */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter email subject" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Body Field */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Compose your email..."
                      rows={12}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Available variables: {"{"}firstName{"}"}, {"{"}lastName{"}"},{" "}
                    {"{"}company{"}"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSending} className="flex-1">
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Email
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
