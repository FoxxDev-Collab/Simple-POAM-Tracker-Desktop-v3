import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(date))
}

export function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'closed':
    case 'resolved':
      return 'text-green-600 bg-green-50 border-green-200'
    case 'in-progress':
    case 'active':
    case 'ongoing':
      return 'text-blue-600 bg-blue-50 border-blue-200'
    case 'pending':
    case 'waiting':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'overdue':
    case 'delayed':
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'draft':
    case 'planned':
      return 'text-gray-600 bg-gray-50 border-gray-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function getPriorityColor(priority: string) {
  switch (priority.toLowerCase()) {
    case 'high':
    case 'critical':
      return 'text-red-600 bg-red-50 border-red-200'
    case 'medium':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'low':
      return 'text-green-600 bg-green-50 border-green-200'
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '...'
} 

// Natural sort for NIST control IDs like "AC-2", "AC-10", "AC-2(1)", "AC-2 (1)(a)"
export type ParsedNistControlId = {
  family: string
  baseNumber: number
  enhancementNumber: number | null
  suffix: string | null
}

export function parseNistControlId(id: string): ParsedNistControlId {
  // Normalize spaces, e.g. "AC-2 (1)" -> "AC-2(1)"
  const normalized = id.replace(/\s+/g, '')
  // Match patterns like AC-2, AC-2(1), AC-2(1)(a)
  const familyMatch = normalized.match(/^([A-Z]{2})-/)
  const family = familyMatch ? familyMatch[1] : ''

  // Extract numeric base after family-
  const baseMatch = normalized.match(/^[A-Z]{2}-(\d+)/)
  const baseNumber = baseMatch ? parseInt(baseMatch[1], 10) : Number.MAX_SAFE_INTEGER

  // First numeric enhancement inside parentheses, if present
  const enhMatch = normalized.match(/\((\d+)\)/)
  const enhancementNumber = enhMatch ? parseInt(enhMatch[1], 10) : null

  // Optional trailing non-numeric suffix in parentheses like (a)
  const suffixMatch = normalized.match(/\(\d+\)\(([a-zA-Z])\)$/)
  const suffix = suffixMatch ? suffixMatch[1].toLowerCase() : null

  return { family, baseNumber, enhancementNumber, suffix }
}

export function compareNistControlIdStrings(a: string, b: string): number {
  const pa = parseNistControlId(a)
  const pb = parseNistControlId(b)

  const familyCompare = pa.family.localeCompare(pb.family)
  if (familyCompare !== 0) return familyCompare

  if (pa.baseNumber !== pb.baseNumber) return pa.baseNumber - pb.baseNumber

  const aEnh = pa.enhancementNumber ?? -1
  const bEnh = pb.enhancementNumber ?? -1
  if (aEnh !== bEnh) return aEnh - bEnh

  // Compare suffix if both present
  if (pa.suffix && pb.suffix) return pa.suffix.localeCompare(pb.suffix)
  if (pa.suffix && !pb.suffix) return 1
  if (!pa.suffix && pb.suffix) return -1

  // Fallback to lexicographic if everything else equal
  return a.localeCompare(b)
}