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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Save } from 'lucide-react';

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

        // Open mailto link
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
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Editor */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Compose Email</CardTitle>
            <CardDescription>
              Select a template and customize your message
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Template selector */}
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.is_default && '(Default)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contact selector */}
            <div className="space-y-2">
              <Label>Contact</Label>
              <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a contact" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.full_name} - {contact.company || 'No company'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Email body (use {{firstName}}, {{lastName}}, {{companyName}}, {{role}})"
                rows={12}
                className="font-mono text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                onClick={handleSaveDraft}
                disabled={saving || !selectedContactId}
                variant="outline"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Draft
                  </>
                )}
              </Button>

              <Button
                onClick={handleMarkAsSent}
                disabled={saving || !selectedContactId}
              >
                <Mail className="mr-2 h-4 w-4" />
                Open in Email Client
              </Button>
            </div>

            {/* Status messages */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert>
                <AlertDescription className="text-green-600">{success}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              How the email will look with variables replaced
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedContact ? (
              <>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <div className="text-sm">
                    {selectedContact.full_name} ({selectedContact.confirmed_email || selectedContact.inferred_email})
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Subject</Label>
                  <div className="rounded-md border bg-muted/50 p-3 text-sm">
                    {preview.subject || <span className="text-muted-foreground">No subject</span>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Body</Label>
                  <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                    {preview.body || <span className="text-muted-foreground">No body</span>}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                Select a contact to see preview
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available variables */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Available Variables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-xs">
              <div className="font-mono">{'{{firstName}}'} - Contact's first name</div>
              <div className="font-mono">{'{{lastName}}'} - Contact's last name</div>
              <div className="font-mono">{'{{fullName}}'} - Contact's full name</div>
              <div className="font-mono">{'{{companyName}}'} - Company name</div>
              <div className="font-mono">{'{{role}}'} - Contact's role</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
