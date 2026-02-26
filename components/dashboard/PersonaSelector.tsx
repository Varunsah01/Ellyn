"use client"

import { motion } from "framer-motion"
import { Briefcase, TrendingUp, Check } from "lucide-react"

import type { Persona } from "@/lib/persona-copy"

type Props = {
  value: Persona | null
  onChange: (p: Persona) => void
}

const OPTIONS: {
  value: Persona
  icon: React.ReactNode
  label: string
  subtitle: string
}[] = [
  {
    value: "job_seeker",
    icon: <Briefcase className="h-6 w-6" />,
    label: "I'm finding jobs",
    subtitle: "Reach hiring managers & recruiters",
  },
  {
    value: "smb_sales",
    icon: <TrendingUp className="h-6 w-6" />,
    label: "I'm generating leads",
    subtitle: "Find & contact B2B prospects",
  },
]

export function PersonaSelector({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <motion.button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              whileTap={{ scale: 0.97 }}
              className="relative flex flex-col items-center gap-2 rounded-xl border-2 p-5 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D2B55] focus-visible:ring-offset-2"
              style={{
                borderColor: selected ? "#7C3AED" : "#E5E7EB",
                backgroundColor: selected ? "#EDE9FE" : "#FFFFFF",
              }}
            >
              {/* Checkmark badge */}
              {selected && (
                <motion.span
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#7C3AED]"
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </motion.span>
              )}

              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: selected ? "#7C3AED" : "#F3F4F6",
                  color: selected ? "#FFFFFF" : "#2D2B55",
                }}
              >
                {opt.icon}
              </span>

              <span className="font-semibold text-[#2D2B55]">{opt.label}</span>
              <span className="text-sm text-gray-500">{opt.subtitle}</span>
            </motion.button>
          )
        })}
      </div>

      <p className="text-center text-xs text-gray-400">
        You can switch anytime in Settings
      </p>
    </div>
  )
}
