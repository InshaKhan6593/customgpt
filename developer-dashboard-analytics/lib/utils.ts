import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic number formatting that avoids locale-dependent toLocaleString hydration mismatches */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n)
}

/** Deterministic currency formatting */
export function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
}
