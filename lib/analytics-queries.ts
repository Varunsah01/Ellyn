export const analyticsQueries = {
  contactsOverTime: `
    SELECT DATE(created_at) AS date, COUNT(*)
    FROM contacts
    GROUP BY date
    ORDER BY date;
  `,
  replyRateBySequence: `
    SELECT s.name,
      COUNT(CASE WHEN o.status = 'replied' THEN 1 END) * 100.0 / COUNT(*) AS reply_rate
    FROM sequences s
    JOIN outreach o ON o.sequence_id = s.id
    GROUP BY s.id;
  `,
  topCompanies: `
    SELECT company, COUNT(*)
    FROM contacts
    GROUP BY company
    ORDER BY COUNT(*) DESC
    LIMIT 10;
  `,
}

const PROVIDER_RULES: Array<{ label: string; domains: string[] }> = [
  { label: "Gmail", domains: ["gmail.com"] },
  { label: "Outlook", domains: ["outlook.com", "hotmail.com", "live.com", "msn.com"] },
  { label: "Yahoo", domains: ["yahoo.com"] },
  { label: "iCloud", domains: ["icloud.com", "me.com", "mac.com"] },
  { label: "Proton", domains: ["proton.me", "protonmail.com"] },
]

export function classifyEmailProvider(email?: string | null) {
  if (!email) return "Unknown"
  const domain = email.split("@")[1]?.toLowerCase() ?? ""
  if (!domain) return "Unknown"

  for (const rule of PROVIDER_RULES) {
    if (rule.domains.includes(domain)) {
      return rule.label
    }
  }

  if (domain.endsWith(".edu")) return "Education"
  if (domain.endsWith(".gov")) return "Government"
  return "Company"
}
