import { fetchAdminApi } from '@/lib/admin/fetch-admin-api'
import { HealthCharts } from './HealthCharts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HealthResponse = Record<string, any>

export default async function HealthPage() {
  let response: HealthResponse | null = null
  let error: string | null = null

  try {
    response = await fetchAdminApi<HealthResponse>('/api/admin/system-health')
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load data'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">System Health &amp; API Monitoring</h1>
        <p className="text-sm text-gray-400 mt-1">
          Operational coverage across all 10 stages of the email verification pipeline.
        </p>
      </div>

      {error || !response?.success ? (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-5">
          <p className="text-red-400 text-sm">{error ?? 'Failed to load system health data'}</p>
        </div>
      ) : (
        <HealthCharts data={response} />
      )}
    </div>
  )
}
