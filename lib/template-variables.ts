const VAR_RE = /\{\{([^}]+)\}\}/g

/** Returns unique variable names found in the given text (e.g. ['first_name', 'company']). */
export function extractVariables(text: string): string[] {
  const names: string[] = []
  let m: RegExpExecArray | null
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) {
    const name = m[1]?.trim()
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

/**
 * Replaces {{variable}} tokens with the supplied values.
 * Tokens with no matching value are left untouched so the caller
 * can highlight them as unfilled.
 */
export function fillVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(VAR_RE, (_match, key: string) => {
    const trimmed = key.trim()
    return vars[trimmed] !== undefined ? vars[trimmed] : _match
  })
}

export type PredefinedVariable = {
  name: string
  label: string
  description: string
}

export const PREDEFINED_VARIABLES: PredefinedVariable[] = [
  { name: 'first_name', label: 'First Name', description: "Recipient's first name" },
  { name: 'last_name', label: 'Last Name', description: "Recipient's last name" },
  { name: 'company', label: 'Company', description: "Recipient's company" },
  { name: 'role', label: 'Role / Title', description: "Recipient's job title" },
  { name: 'sender_name', label: 'Your Name', description: 'Your full name' },
  { name: 'your_company', label: 'Your Company', description: 'Your company or product name' },
  { name: 'pain_point', label: 'Pain Point', description: 'Specific challenge you are addressing' },
  { name: 'benefit', label: 'Key Benefit', description: 'Main value you deliver' },
  { name: 'department', label: 'Department', description: "Recipient's department or team" },
  { name: 'target_field', label: 'Target Field', description: 'Industry or field you are targeting' },
  { name: 'your_skill', label: 'Your Skill', description: 'Your key skill or area of expertise' },
  { name: 'mutual_connection', label: 'Mutual Connection', description: 'Name of a shared contact' },
]
