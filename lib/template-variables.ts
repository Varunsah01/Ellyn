const VAR_RE = /\{\{([^}]+)\}\}/g

export function extractVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) ?? []
  return [
    ...new Set(
      matches
        .map((match) => match.replace(/^\{\{|\}\}$/g, '').trim())
        .filter(Boolean)
    ),
  ]
}

export function fillVariables(text: string, vars: Record<string, string>): string {
  return text.replace(VAR_RE, (match, key: string) => {
    const trimmed = key.trim()
    return vars[trimmed] ?? match
  })
}

export const PREDEFINED_VARIABLES: Record<
  string,
  { label: string; description: string }
> = {
  first_name: { label: 'First Name', description: "Recipient's first name" },
  last_name: { label: 'Last Name', description: "Recipient's last name" },
  company: { label: 'Company', description: "Recipient's company name" },
  role: { label: 'Role / Title', description: "Recipient's job title" },
  sender_name: { label: 'Your Name', description: 'Your full name' },
  your_company: { label: 'Your Company', description: 'Your company or university' },
  pain_point: { label: 'Pain Point', description: 'Specific problem they may have' },
  benefit: { label: 'Key Benefit', description: 'Main value you offer' },
  department: { label: 'Department', description: 'Their team or department' },
  their_specialty: {
    label: 'Their Specialty',
    description: 'Area they are known for',
  },
  target_field: {
    label: 'Target Field',
    description: 'Field you are moving into',
  },
  company_achievement: {
    label: 'Company Achievement',
    description: 'Something notable about their company',
  },
}

export type PredefinedVariable = {
  name: string
  label: string
  description: string
}

export const PREDEFINED_VARIABLE_LIST: PredefinedVariable[] = Object.entries(
  PREDEFINED_VARIABLES
).map(([name, value]) => ({
  name,
  label: value.label,
  description: value.description,
}))
