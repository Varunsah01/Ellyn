export interface GmailStatus {
  connected: boolean
  gmailEmail?: string
  connectedAt?: string
}

export interface OutlookStatus {
  connected: boolean
  outlookEmail?: string
  connectedAt?: string
}

export interface EmailIntegrationStatus {
  gmail: GmailStatus
  outlook: OutlookStatus
}
