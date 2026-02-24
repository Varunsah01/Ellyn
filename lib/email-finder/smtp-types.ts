export type SmtpDeliverability =
  | 'DELIVERABLE'
  | 'UNDELIVERABLE'
  | 'UNKNOWN'
  | 'SKIPPED'

export interface SmtpProbeResult {
  email: string
  deliverability: SmtpDeliverability
  reason: string
  mxHost?: string
  skipped: boolean
  stage?: string
}
