import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Cn.
 * @param {ClassValue[]} inputs - Inputs input.
 * @returns {unknown} Computed unknown.
 * @example
 * cn([])
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
