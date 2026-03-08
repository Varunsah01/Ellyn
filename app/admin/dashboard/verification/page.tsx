import { fetchAdminApi } from '@/lib/admin/fetch-admin-api'
import { VerificationCharts } from './VerificationCharts'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VerificationData = Record<string, any>

export default async function VerificationPage() {
  let data: VerificationData | null = null
  let error: string | null = null

  try {
    data = await fetchAdminApi<VerificationData>('/api/admin/verification-stats')
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load data'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Verification Stats</h1>
        <p className="text-sm text-gray-400 mt-1">Abstract API usage &amp; costs</p>
      </div>

      {error || !data?.success ? (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-5">
          <p className="text-red-400 text-sm">{error ?? 'Failed to load verification stats'}</p>
        </div>
      ) : (
        <VerificationCharts data={data as any} />
      )}
    </div>
  )
}
