import { VerificationDashboard } from '@/components/admin/verification-dashboard'

export const metadata = {
  title: 'Verification Stats — Admin',
  description: 'Abstract API usage, costs, and deliverability breakdown',
}

export default function VerificationStatsPage() {
  return <VerificationDashboard />
}
