export type SMTPResult = "valid" | "invalid" | "unknown"

export function getVerificationLabel(smtpStatus: SMTPResult): string {
  switch (smtpStatus) {
    case "valid":
      return "Verified"
    case "invalid":
      return "Invalid"
    case "unknown":
      return "Unknown"
    default:
      return "Not Verified"
  }
}

export function getVerificationColor(smtpStatus: SMTPResult): string {
  switch (smtpStatus) {
    case "valid":
      return "text-green-600 dark:text-green-400"
    case "invalid":
      return "text-red-600 dark:text-red-400"
    case "unknown":
      return "text-yellow-600 dark:text-yellow-400"
    default:
      return "text-gray-600 dark:text-gray-400"
  }
}
