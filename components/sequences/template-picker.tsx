"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, FileText, Heart, MessageSquare, Sparkles, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailTemplate {
  id: string;
  name: string;
  category: "cold-outreach" | "referral" | "follow-up" | "thank-you" | "custom";
  subject: string;
  body: string;
  description: string;
  tags: string[];
}

interface TemplatePickerProps {
  onSelect: (template: EmailTemplate) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const templates: EmailTemplate[] = [
  {
    id: "1",
    name: "Software Engineer Cold Outreach",
    category: "cold-outreach",
    subject: "Quick question about {{company}}",
    body: `Hi {{firstName}},

I noticed you work at {{company}} as a {{role}}. I'm currently exploring opportunities in software engineering and would love to learn more about your experience there.

Would you be open to a brief 15-minute chat? I'd be grateful for any insights you could share about the team culture and growth opportunities.

Best regards,
{{userFirstName}}`,
    description: "Reach out to engineers at companies you're interested in",
    tags: ["engineering", "informational"],
  },
  {
    id: "2",
    name: "Referral Request",
    category: "referral",
    subject: "Referral for {{role}} position at {{company}}",
    body: `Hi {{firstName}},

I hope this message finds you well! I'm reaching out because I saw that {{company}} is hiring for a {{role}} position, and I believe my background would be a great fit.

I have [X years] of experience in [your specialty], and I'm really excited about the work {{company}} is doing in [specific area].

Would you be comfortable providing a referral? I'd be happy to send over my resume and any other information that would be helpful.

Thanks so much for considering!

Best,
{{userFirstName}}`,
    description: "Request referrals from connections at target companies",
    tags: ["referral", "direct"],
  },
  {
    id: "3",
    name: "Follow-up After No Response",
    category: "follow-up",
    subject: "Re: Quick question about {{company}}",
    body: `Hi {{firstName}},

I wanted to follow up on my previous message. I understand you're likely very busy, but I'd still love to connect if you have a few minutes.

Even a brief 10-minute conversation would be incredibly valuable as I explore opportunities at {{company}}.

No pressure at all - just let me know if you'd be open to chatting!

Best,
{{userFirstName}}`,
    description: "Gentle follow-up for contacts who haven't responded",
    tags: ["follow-up", "gentle"],
  },
  {
    id: "4",
    name: "Thank You After Interview",
    category: "thank-you",
    subject: "Thank you for your time!",
    body: `Hi {{firstName}},

Thank you so much for taking the time to speak with me about {{company}} and the {{role}} position. I really enjoyed our conversation and learning more about [specific topic discussed].

I'm even more excited about the opportunity after our chat. The work your team is doing in [area] aligns perfectly with my interests and experience.

Please let me know if there's any additional information I can provide. Looking forward to hearing from you!

Best regards,
{{userFirstName}}`,
    description: "Show gratitude after informational interviews or calls",
    tags: ["thank-you", "professional"],
  },
  {
    id: "5",
    name: "Product Manager Outreach",
    category: "cold-outreach",
    subject: "Learning about PM opportunities at {{company}}",
    body: `Hi {{firstName}},

I came across your profile and saw that you're a {{role}} at {{company}}. I'm actively exploring product management roles and would love to learn about your journey into the field.

I'm particularly interested in how {{company}} approaches [product development/user research/etc.], and any insights you could share would be incredibly helpful.

Would you have 15-20 minutes for a quick call in the coming weeks?

Thanks for considering!

{{userFirstName}}`,
    description: "Tailored outreach for PM-related positions",
    tags: ["product", "career-exploration"],
  },
  {
    id: "6",
    name: "LinkedIn Connection Follow-up",
    category: "follow-up",
    subject: "Great to connect, {{firstName}}!",
    body: `Hi {{firstName}},

Thanks for connecting on LinkedIn! I noticed you're working at {{company}} as a {{role}}, which is exactly the kind of role I'm targeting.

I'd love to learn more about your experience and any advice you might have for someone looking to break into [field/industry].

Would you be open to a brief virtual coffee chat?

Looking forward to hearing from you!

{{userFirstName}}`,
    description: "Follow up after connecting on LinkedIn",
    tags: ["linkedin", "networking"],
  },
  {
    id: "7",
    name: "Event Follow-up",
    category: "follow-up",
    subject: "Great meeting you at [Event Name]",
    body: `Hi {{firstName}},

It was great meeting you at [Event Name]! I really enjoyed our conversation about [topic discussed].

I'd love to continue the conversation and learn more about your work at {{company}}. Would you be open to grabbing coffee or having a quick call in the next couple of weeks?

Thanks again for your time at the event!

Best,
{{userFirstName}}`,
    description: "Follow up after meeting someone at a networking event",
    tags: ["networking", "event"],
  },
  {
    id: "8",
    name: "Alumni Outreach",
    category: "cold-outreach",
    subject: "Fellow [University] alum seeking advice",
    body: `Hi {{firstName}},

I'm a fellow [University] alum (Class of [Year]) and I noticed you're now working at {{company}} as a {{role}}.

I'm currently in the job search and would greatly appreciate any advice or insights you could share about your career path and experience at {{company}}.

Would you have 15 minutes for a quick call? I'd love to hear about your journey since graduation.

Go [mascot]!

{{userFirstName}}`,
    description: "Leverage alumni connections for informational interviews",
    tags: ["alumni", "university"],
  },
];

export function TemplatePicker({ onSelect, open, onOpenChange }: TemplatePickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<EmailTemplate["category"] | "all">("all");
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const filteredTemplates = selectedCategory === "all"
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  const categoryIcons: Record<EmailTemplate["category"], any> = {
    "cold-outreach": Mail,
    "referral": Heart,
    "follow-up": MessageSquare,
    "thank-you": Sparkles,
    "custom": FileText,
  };

  const categoryLabels: Record<EmailTemplate["category"], string> = {
    "cold-outreach": "Cold Outreach",
    "referral": "Referral Request",
    "follow-up": "Follow-up",
    "thank-you": "Thank You",
    "custom": "Custom",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Choose Email Template</DialogTitle>
            <DialogDescription>
              Select a pre-built template or start from scratch
            </DialogDescription>
          </DialogHeader>

          <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="cold-outreach">Cold Outreach</TabsTrigger>
              <TabsTrigger value="referral">Referral</TabsTrigger>
              <TabsTrigger value="follow-up">Follow-up</TabsTrigger>
              <TabsTrigger value="thank-you">Thank You</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="flex-1 overflow-y-auto mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                {filteredTemplates.map((template) => {
                  const Icon = categoryIcons[template.category];
                  return (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:border-primary transition-all group"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Icon className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-base line-clamp-1">
                                {template.name}
                              </CardTitle>
                              <CardDescription className="text-xs mt-1 line-clamp-2">
                                {template.description}
                              </CardDescription>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="bg-muted p-3 rounded-md">
                          <p className="text-xs font-medium mb-1">Subject:</p>
                          <p className="text-sm line-clamp-1">{template.subject}</p>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {template.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={() => setPreviewTemplate(template)}
                            variant="outline"
                            className="flex-1"
                          >
                            <Eye className="mr-2 h-3 w-3" />
                            Preview
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              onSelect(template);
                              onOpenChange(false);
                            }}
                            className="flex-1"
                          >
                            Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No templates in this category yet</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      {previewTemplate && (
        <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{previewTemplate.name}</DialogTitle>
              <DialogDescription>{previewTemplate.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <div>
                <p className="text-sm font-medium mb-2">Subject Line:</p>
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm">{previewTemplate.subject}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-2">Email Body:</p>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {previewTemplate.body}
                  </pre>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Variables like {"{{firstName}}"} and {"{{company}}"} will be automatically replaced with contact data
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setPreviewTemplate(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    onSelect(previewTemplate);
                    setPreviewTemplate(null);
                    onOpenChange(false);
                  }}
                >
                  Use This Template
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
