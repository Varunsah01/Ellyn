export type AdminRuntimeSettings = {
  deepseekR1Enabled: boolean
  lookupCostEfficiencyTarget: number
  adminIpWhitelist: string[]
}

const LOOKUP_EFFICIENCY_MIN = 0
const LOOKUP_EFFICIENCY_MAX = 100
const LOOKUP_EFFICIENCY_DEFAULT = 65

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  const normalized = value.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return fallback
}

function clampEfficiencyTarget(value: number): number {
  if (!Number.isFinite(value)) return LOOKUP_EFFICIENCY_DEFAULT
  return Math.min(LOOKUP_EFFICIENCY_MAX, Math.max(LOOKUP_EFFICIENCY_MIN, Math.round(value)))
}

function parseWhitelist(rawValue: string | undefined): string[] {
  if (!rawValue) return []

  return rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

let runtimeSettings: AdminRuntimeSettings = {
  deepseekR1Enabled: parseBoolean(process.env.DEEPSEEK_R1_ENABLED, true),
  lookupCostEfficiencyTarget: clampEfficiencyTarget(Number(process.env.LOOKUP_COST_EFFICIENCY_TARGET)),
  adminIpWhitelist: parseWhitelist(process.env.ADMIN_IP_WHITELIST),
}

export function getAdminRuntimeSettings(): AdminRuntimeSettings {
  return {
    deepseekR1Enabled: runtimeSettings.deepseekR1Enabled,
    lookupCostEfficiencyTarget: runtimeSettings.lookupCostEfficiencyTarget,
    adminIpWhitelist: [...runtimeSettings.adminIpWhitelist],
  }
}

export function updateAdminRuntimeSettings(partial: Partial<AdminRuntimeSettings>): AdminRuntimeSettings {
  runtimeSettings = {
    deepseekR1Enabled:
      typeof partial.deepseekR1Enabled === 'boolean'
        ? partial.deepseekR1Enabled
        : runtimeSettings.deepseekR1Enabled,
    lookupCostEfficiencyTarget:
      typeof partial.lookupCostEfficiencyTarget === 'number'
        ? clampEfficiencyTarget(partial.lookupCostEfficiencyTarget)
        : runtimeSettings.lookupCostEfficiencyTarget,
    adminIpWhitelist:
      Array.isArray(partial.adminIpWhitelist)
        ? partial.adminIpWhitelist.map((value) => value.trim()).filter(Boolean)
        : runtimeSettings.adminIpWhitelist,
  }

  return getAdminRuntimeSettings()
}

export const ADMIN_LOOKUP_COST_EFFICIENCY_BOUNDS = {
  min: LOOKUP_EFFICIENCY_MIN,
  max: LOOKUP_EFFICIENCY_MAX,
}
