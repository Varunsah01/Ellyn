import { fetchAdminApi } from '@/lib/admin/fetch-admin-api'
import type { AdminDomainStats } from '@/lib/domain-resolution-analytics'
import { DomainAccuracyCharts } from './DomainAccuracyCharts'

type DomainAccuracyResponse = {
  success: boolean
  data: AdminDomainStats
  windowDays: number
}

export default async function DomainAccuracyPage() {
  let response: DomainAccuracyResponse | null = null
  let error: string | null = null

  try {
    response = await fetchAdminApi<DomainAccuracyResponse>('/api/admin/domain-accuracy?days=30')
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load data'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Domain Resolution Accuracy</h1>
        <p className="text-sm text-gray-400 mt-1">Last 30 days</p>
      </div>

      {error || !response?.success ? (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-5">
          <p className="text-red-400 text-sm">{error ?? 'Failed to load domain accuracy data'}</p>
        </div>
      ) : (
        <DomainAccuracyCharts data={response.data} />
      )}
    </div>
  )
}
