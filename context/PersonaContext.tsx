"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import type { Persona } from '@/lib/persona-copy'
import { showToast } from '@/lib/toast'

const LS_KEY = 'ellyn_persona'
const PERSONA_API_PATH = '/api/v1/user/persona'
const ONBOARDING_API_PATH = '/api/v1/user/onboarding'
const ANALYTICS_API_PATH = '/api/v1/analytics'
const EXTENSION_INSTALLED_STEP = 'extension_installed'
const EXTENSION_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000

type PersonaContextValue = {
  persona: Persona
  setPersona: (p: Persona) => Promise<void>
  isJobSeeker: boolean
  isSalesRep: boolean
  isLoading: boolean
  onboardingStepsCompleted: string[]
  onboardingCompleted: boolean
  refreshOnboardingSteps: () => void
}

type PersonaApiResponse = {
  persona?: Persona | null
  onboarding_steps_completed?: string[] | null
  extension_last_seen?: string | null
  onboarding_completed?: boolean | null
}

type PersonaPatchResponse = {
  persona?: Persona | null
}

const defaultValue: PersonaContextValue = {
  persona: 'job_seeker',
  setPersona: async () => {},
  isJobSeeker: true,
  isSalesRep: false,
  isLoading: true,
  onboardingStepsCompleted: [],
  onboardingCompleted: false,
  refreshOnboardingSteps: () => {},
}

const PersonaContext = createContext<PersonaContextValue>(defaultValue)

function isPersona(value: unknown): value is Persona {
  return value === 'job_seeker' || value === 'smb_sales'
}

function readLocalPersona(): Persona | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return isPersona(raw) ? raw : null
  } catch {
    return null
  }
}

function writeLocalPersona(p: Persona) {
  try {
    localStorage.setItem(LS_KEY, p)
  } catch {
    // localStorage unavailable
  }
}

function normalizeSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

function hasRecentExtensionHeartbeat(lastSeen: string | null | undefined): boolean {
  if (!lastSeen) return false
  const timestamp = new Date(lastSeen).getTime()
  if (Number.isNaN(timestamp)) return false
  return Date.now() - timestamp <= EXTENSION_LOOKBACK_MS
}

function markOnboardingStep(step: string) {
  void fetch(ONBOARDING_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step }),
  }).catch((error) => {
    console.error('[PersonaContext] Failed to mark onboarding step', error)
  })
}

function logPersonaChange(persona: Persona) {
  void fetch(ANALYTICS_API_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'persona_changed',
      persona,
      source: 'PersonaContext',
      timestamp: new Date().toISOString(),
    }),
  }).catch((error) => {
    console.error('[PersonaContext] Failed to log persona change', error)
  })
}

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>('job_seeker')
  const [isLoading, setIsLoading] = useState(true)
  const [onboardingStepsCompleted, setOnboardingStepsCompleted] = useState<string[]>([])
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)

  useEffect(() => {
    const cached = readLocalPersona()
    if (cached) {
      setPersonaState(cached)
    }

    let cancelled = false

    const fetchPersona = async () => {
      try {
        const res = await fetch(PERSONA_API_PATH)
        if (!res.ok) return

        const data = (await res.json()) as PersonaApiResponse
        if (cancelled) return

        if (isPersona(data.persona)) {
          setPersonaState(data.persona)
          writeLocalPersona(data.persona)
        }

        const steps = normalizeSteps(data.onboarding_steps_completed)
        setOnboardingStepsCompleted(steps)
        setOnboardingCompleted(Boolean(data.onboarding_completed))

        if (
          hasRecentExtensionHeartbeat(data.extension_last_seen) &&
          !steps.includes(EXTENSION_INSTALLED_STEP)
        ) {
          markOnboardingStep(EXTENSION_INSTALLED_STEP)
        }
      } catch (error) {
        console.error('[PersonaContext] Failed to fetch persona', error)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void fetchPersona()

    return () => {
      cancelled = true
    }
  }, [])

  const refreshOnboardingSteps = useCallback(() => {
    void fetch(PERSONA_API_PATH)
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as PersonaApiResponse
        const steps = normalizeSteps(data.onboarding_steps_completed)
        setOnboardingStepsCompleted(steps)
        setOnboardingCompleted(Boolean(data.onboarding_completed))
      })
      .catch((error) => {
        console.error('[PersonaContext] Failed to refresh onboarding steps', error)
      })
  }, [])

  const setPersona = useCallback(
    async (nextPersona: Persona) => {
      const previousPersona = persona

      setPersonaState(nextPersona)
      writeLocalPersona(nextPersona)

      try {
        const res = await fetch(PERSONA_API_PATH, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: nextPersona }),
        })

        if (!res.ok) {
          throw new Error('Failed to save persona preference')
        }

        const data = (await res.json()) as PersonaPatchResponse
        const savedPersona = isPersona(data.persona) ? data.persona : nextPersona
        setPersonaState(savedPersona)
        writeLocalPersona(savedPersona)
        logPersonaChange(savedPersona)
      } catch (error) {
        setPersonaState(previousPersona)
        writeLocalPersona(previousPersona)
        showToast.error('Failed to save persona preference')
        throw error
      }
    },
    [persona]
  )

  return (
    <PersonaContext.Provider
      value={{
        persona,
        setPersona,
        isJobSeeker: persona === 'job_seeker',
        isSalesRep: persona === 'smb_sales',
        isLoading,
        onboardingStepsCompleted,
        onboardingCompleted,
        refreshOnboardingSteps,
      }}
    >
      {children}
    </PersonaContext.Provider>
  )
}

export function usePersona() {
  return useContext(PersonaContext)
}
