"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface TemplatePreviewProps {
  subject: string
  body: string
  className?: string
  sampleData?: Record<string, string>
}

const DEFAULT_SAMPLE_DATA: Record<string, string> = {
  firstName: 'John',
  lastName: 'Doe',
  fullName: 'John Doe',
  company: 'Google',
  role: 'Software Engineer',
  userFirstName: 'Alex',
  userLastName: 'Taylor',
  userName: 'Alex Taylor',
  userSchool: 'Stanford University',
  userMajor: 'Computer Science',
}

export function TemplatePreview({ subject, body, className, sampleData }: TemplatePreviewProps) {
  const mergedData = {
    ...DEFAULT_SAMPLE_DATA,
    ...sampleData,
  }

  const previewSubject = replaceVariables(subject, mergedData)
  const previewBody = replaceVariables(body, mergedData)

  return (
    <Card className={cn('border-blue-200/60 bg-blue-50/40', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-slate-900">Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Subject</p>
          <p className="mt-1 text-sm text-slate-900">{previewSubject || '(No subject)'}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Body</p>
          <pre className="mt-1 whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
            {previewBody || '(No body content)'}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}

function replaceVariables(template: string, values: Record<string, string>): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_, key: string) => values[key] || `{{${key}}}`)
}
