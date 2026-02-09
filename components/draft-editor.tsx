'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Mail, Save, Eye, PenSquare } from 'lucide-react';
import { cn } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
}

interface Contact {
  id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  role?: string;
  confirmed_email?: string;
  inferred_email?: string;
}

interface DraftEditorProps {
  contactId?: string;
  draftId?: string;
}

export function DraftEditor({ contactId, draftId }: DraftEditorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [selectedContactId, setSelectedContactId] = useState<string>(contactId || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState("write");

  // Load templates and contacts
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);

        // Fetch templates
        const templatesRes = await fetch('/api/templates');
        const templatesData = await templatesRes.json();

        if (templatesData.success) {
          setTemplates(templatesData.templates);
        }

        // Fetch contacts
        const contactsRes = await fetch('/api/contacts?limit=1000');
        const contactsData = await contactsRes.json();

        if (contactsData.success) {
          setContacts(contactsData.contacts || []);
        }

        // Load existing draft if draftId provided
        if (draftId) {
          const draftRes = await fetch(`/api/drafts?id=${draftId}`);
          const draftData = await draftRes.json();

          if (draftData.success && draftData.drafts.length > 0) {
            const draft = draftData.drafts[0];
            setSelectedContactId(draft.contact_id);
            setSubject(draft.subject);
            setBody(draft.body);
            if (draft.template_id) {
              setSelectedTemplateId(draft.template_id);
            }
          }
        }
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [draftId]);

  // Replace variables in text
  function replaceVariables(text: string, contact: Contact | undefined): string {
    if (!contact) return text;

    const firstName = contact.first_name || contact.full_name.split(' ')[0] || '';
    const lastName = contact.last_name || contact.full_name.split(' ').slice(1).join(' ') || '';
    const fullName = contact.full_name || '';
    const company = contact.company || '[Company]';
    const role = contact.role || '[Role]';

    return text
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{lastName\}\}/g, lastName)
      .replace(/\{\{fullName\}\}/g, fullName)
      .replace(/\{\{companyName\}\}/g, company)
      .replace(/\{\{Company\}\}/g, company)
      .replace(/\{\{role\}\}/g, role);
  }

  // Handle template selection
  function handleTemplateSelect(templateId: string) {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);

    if (template) {
      setSubject(template.subject);
      setBody(template.body);
    }
  }

  // Get preview with variables replaced
  function getPreview(): { subject: string; body: string } {
    const contact = contacts.find(c => c.id === selectedContactId);

    return {
      subject: replaceVariables(subject, contact),
      body: replaceVariables(body, contact),
    };
  }

  // Generate mailto link
  function generateMailtoLink(): string {
    const contact = contacts.find(c => c.id === selectedContactId);
    const email = contact?.confirmed_email || contact?.inferred_email || '';
    const preview = getPreview();

    const mailtoSubject = encodeURIComponent(preview.subject);
    const mailtoBody = encodeURIComponent(preview.body);

    return `mailto:${email}?subject=${mailtoSubject}&body=${mailtoBody}`;
  }

  // Save draft
  async function handleSaveDraft() {
    if (!selectedContactId) {
      setError('Please select a contact');
      return;
    }

    if (!subject || !body) {
      setError('Subject and body are required');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draftId,
          contactId: selectedContactId,
          subject,
          body,
          status: 'draft',
          templateId: selectedTemplateId || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Draft saved successfully!');
      } else {
        setError(data.error || 'Failed to save draft');
      }
    } catch (err) {
      setError('Failed to save draft');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  // Mark as sent
  async function handleMarkAsSent() {
    if (!selectedContactId) {
      setError('Please select a contact');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch('/api/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: draftId,
          contactId: selectedContactId,
          subject,
          body,
          status: 'sent',
          templateId: selectedTemplateId || null,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Marked as sent!');
        window.location.href = generateMailtoLink();
      } else {
        setError(data.error || 'Failed to mark as sent');
      }
    } catch (err) {
      setError('Failed to mark as sent');
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const preview = getPreview();

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* Context Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 items-start sm:items-center justify-between">
        <div className="flex gap-4 flex-1 w-full sm:w-auto">
          <Select value={selectedContactId} onValueChange={setSelectedContactId}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="To: Select Contact" />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((contact) => (
                <SelectItem key={contact.id} value={contact.id}>
                  {contact.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
            <SelectTrigger className="w-[200px] bg-background">
              <SelectValue placeholder="Template: None" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="write">
              <PenSquare className="mr-2 h-4 w-4" /> Write
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="mr-2 h-4 w-4" /> Preview
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="bg-card shadow-sm border rounded-lg min-h-[600px] p-8 md:p-12 relative">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="write" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
             {/* Subject - Minimalist */}
            <div className="space-y-2">
               <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject Line"
                className="text-2xl font-fraunces font-bold border-none shadow-none px-0 focus-visible:ring-0 placeholder:text-muted-foreground/40"
              />
              <div className="h-px w-20 bg-border/50" />
            </div>

            {/* Body - Clean Notebook */}
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {{firstName}}..."
              className="min-h-[400px] resize-none border-none shadow-none px-0 focus-visible:ring-0 text-base leading-relaxed font-dm-sans placeholder:text-muted-foreground/40"
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
             {selectedContact ? (
              <div className="space-y-6">
                 <div className="border-b pb-4">
                  <p className="text-sm text-muted-foreground mb-1">Subject</p>
                  <h3 className="text-xl font-bold font-fraunces">{preview.subject || <span className="text-muted-foreground opacity-50">No subject</span>}</h3>
                 </div>
                 <div className="prose prose-slate max-w-none">
                   <p className="text-base leading-relaxed whitespace-pre-wrap font-dm-sans text-foreground">
                    {preview.body || <span className="text-muted-foreground opacity-50">No content yet...</span>}
                   </p>
                 </div>
              </div>
             ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                   <Eye className="h-12 w-12 mb-4 opacity-20" />
                   <p>Select a contact to see the preview</p>
                </div>
             )}
          </TabsContent>
        </Tabs>
      </div>
      
       {/* Feedback & Actions */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-background/80 backdrop-blur-md p-2 rounded-full border shadow-lg z-50">
          <Button
            onClick={handleSaveDraft}
            disabled={saving || !selectedContactId}
            variant="ghost"
            size="sm"
            className="rounded-full px-4"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-muted-foreground" />}
            <span className="ml-2">Save</span>
          </Button>
          
          <div className="h-4 w-px bg-border" />

          <Button
            onClick={handleMarkAsSent}
            disabled={saving || !selectedContactId}
            size="sm"
            className="rounded-full px-6"
          >
            <Mail className="mr-2 h-4 w-4" />
            Send Email
          </Button>
      </div>

      {/* Messages */}
      <div className="fixed bottom-24 right-6 z-50">
        {error && (
          <Alert variant="destructive" className="animate-in slide-in-from-right">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="bg-green-50 border-green-200 text-green-800 animate-in slide-in-from-right">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}