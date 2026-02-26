"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import type { Persona } from '@/lib/persona-copy'

const LS_KEY = 'ellyn_persona'

type PersonaContextValue = {
  persona: Persona
  setPersona: (p: Persona) => Promise<void>
  isJobSeeker: boolean
  isSalesRep: boolean
  isLoading: boolean
}

const defaultValue: PersonaContextValue = {
  persona: 'job_seeker',
  setPersona: async () => {},
  isJobSeeker: true,
  isSalesRep: false,
  isLoading: true,
}

const PersonaContext = createContext<PersonaContextValue>(defaultValue)

function readLocalPersona(): Persona | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw === 'job_seeker' || raw === 'smb_sales') return raw
  } catch {
    // localStorage unavailable
  }
  return null
}

function writeLocalPersona(p: Persona) {
  try {
    localStorage.setItem(LS_KEY, p)
  } catch {
    // localStorage unavailable
  }
}

export function PersonaProvider({ children }: { children: React.ReactNode }) {
  const [persona, setPersonaState] = useState<Persona>(
    () => readLocalPersona() ?? 'job_seeker'
  )
  const [isLoading, setIsLoading] = useState(true)

  // Fetch authoritative value from DB on mount
  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/user/persona')
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { persona: Persona }
        if (!cancelled && (data.persona === 'job_seeker' || data.persona === 'smb_sales')) {
          setPersonaState(data.persona)
          writeLocalPersona(data.persona)
        }
      })
      .catch(() => {
        // Non-fatal — keep local value
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const setPersona = useCallback(async (p: Persona) => {
    // Optimistic update
    setPersonaState(p)
    writeLocalPersona(p)

    const res = await fetch('/api/v1/user/persona', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: p }),
    })

    if (!res.ok) {
      throw new Error('Failed to save persona')
    }
  }, [])

  return (
    <PersonaContext.Provider
      value={{
        persona,
        setPersona,
        isJobSeeker: persona === 'job_seeker',
        isSalesRep: persona === 'smb_sales',
        isLoading,
      }}
    >
      {children}
    </PersonaContext.Provider>
  )
}

export function usePersona() {
  return useContext(PersonaContext)
}
