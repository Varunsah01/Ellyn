import { batchVerifyDomains } from '@/lib/mx-verification'
import { buildCacheKey, getOrSet } from '@/lib/cache/redis'
import { CACHE_TAGS } from '@/lib/cache/tags'

export interface SmartResolveResult {
  domain: string
  confidence: number   // 40–65, reflects TLD reliability
  tld: string
}

const TLD_SETS = {
  acronym:   ['.com', '.co', '.io', '.ai', '.net', '.org'],
  tech:      ['.io', '.ai', '.com', '.co', '.dev', '.app', '.tech'],
  finance:   ['.com', '.co', '.co.uk', '.de', '.net'],
  india:     ['.com', '.in', '.co.in', '.net'],
  uk:        ['.com', '.co.uk', '.uk', '.net'],
  germany:   ['.com', '.de', '.net'],
  australia: ['.com', '.com.au', '.net.au', '.au'],
  brazil:    ['.com', '.com.br', '.net.br', '.br'],
  default:   ['.com', '.co', '.io', '.net', '.org'],
} as const

const TLD_CONFIDENCE: Record<string, number> = {
  '.com': 65, '.co': 55, '.co.uk': 55, '.com.au': 55, '.com.br': 55,
  '.io': 50,  '.ai': 50, '.de': 50,    '.in': 50,
  '.net': 45, '.co.in': 45, '.uk': 45, '.net.au': 45, '.net.br': 45, '.au': 45, '.br': 45,
  '.org': 40, '.dev': 45, '.app': 45, '.tech': 40,
}

const COMPANY_SUFFIX_RE = /\b(incorporated|corporation|company|limited|inc|llc|ltd|corp|co|plc|group|holdings|international|global|technologies|tech|services|solutions|systems|software|digital|labs|studio|agency|consulting|consultancy|partners)\b\.?$/gi

function cleanCompanyName(name: string): string {
  return name.toLowerCase().replace(COMPANY_SUFFIX_RE, '').replace(/[^a-z0-9]/g, '').trim()
}

function selectTldCandidates(rawName: string, cleanName: string): string[] {
  const isAcronymOrShort = /^[A-Z0-9]{2,4}$/.test(rawName.trim()) || cleanName.length <= 4
  const isTech    = /tech|software|digital|labs|cloud|ai|ml|dev/i.test(rawName)
  const isFinance = /bank|financial|capital|invest|pay|fintech|insurance|fund|asset|wealth/i.test(rawName)
  const isIndia   = /india|indian|bharti|tata|reliance|infosys|wipro|mahindra/i.test(rawName)
  const isUK      = /\b(uk|british|england|london|scotland|wales)\b/i.test(rawName)
  const isGermany = /\b(german|deutschland|berlin|munich)\b/i.test(rawName)
  const isAus     = /\b(australia|australian|sydney|melbourne)\b/i.test(rawName)
  const isBrazil  = /\b(brazil|brasil)\b/i.test(rawName)

  let tlds: readonly string[]
  if      (isIndia)          tlds = TLD_SETS.india
  else if (isUK)             tlds = TLD_SETS.uk
  else if (isGermany)        tlds = TLD_SETS.germany
  else if (isAus)            tlds = TLD_SETS.australia
  else if (isBrazil)         tlds = TLD_SETS.brazil
  else if (isAcronymOrShort) tlds = TLD_SETS.acronym
  else if (isTech)           tlds = TLD_SETS.tech
  else if (isFinance)        tlds = TLD_SETS.finance
  else                       tlds = TLD_SETS.default

  return tlds.map(tld => `${cleanName}${tld}`)
}

export async function smartResolveDomain(companyName: string): Promise<SmartResolveResult | null> {
  const cleanName = cleanCompanyName(companyName)
  if (!cleanName) return null

  const cacheKey = buildCacheKey(['smart-tld', cleanName])

  return getOrSet<SmartResolveResult | null>({
    key: cacheKey,
    ttlSeconds: 7 * 24 * 60 * 60,
    cacheNull: true,
    nullTtlSeconds: 60 * 60,
    tags: [CACHE_TAGS.domainLookup],
    fetcher: async () => {
      const candidates = selectTldCandidates(companyName, cleanName)
      console.log('[SmartTLD] Checking candidates for', companyName, ':', candidates)

      // Parallel MX check with 3s hard timeout across all candidates
      let mxResults: Map<string, { hasMX: boolean }> | null = null
      try {
        mxResults = await Promise.race([
          batchVerifyDomains(candidates),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('SmartTLD timeout')), 3000)
          ),
        ])
      } catch {
        console.warn('[SmartTLD] Resolution timed out for', companyName)
        return null
      }

      // Return first candidate (in priority order) that has MX records
      for (const candidate of candidates) {
        const mx = mxResults.get(candidate)
        if (mx?.hasMX) {
          const tld = candidate.slice(cleanName.length)
          const confidence = TLD_CONFIDENCE[tld] ?? 40
          console.log('[SmartTLD] Resolved', companyName, '→', candidate, `(confidence: ${confidence})`)
          return { domain: candidate, confidence, tld }
        }
      }

      console.log('[SmartTLD] No valid domain found for', companyName)
      return null
    },
  })
}
