/** Pending itinerary from landing demo → Plan page import (sessionStorage only; never auto-saves). */

export const PENDING_ITINERARY_STORAGE_KEY = 'scheduleSkies_pendingItinerary'
export const PENDING_ITINERARY_VERSION = 1

const ALLOWED_CATEGORIES = ['Food', 'SightSeeing', 'Hotel', 'Leisure']

export function normalizeItineraryCategory(raw) {
  if (!raw) return 'Leisure'
  const s = String(raw).trim()
  if (ALLOWED_CATEGORIES.includes(s)) return s
  const lower = s.toLowerCase()
  if (lower.includes('food') || lower.includes('restaurant') || lower.includes('eat') || lower.includes('café') || lower.includes('cafe')) {
    return 'Food'
  }
  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('resort') || lower.includes('lodging')) {
    return 'Hotel'
  }
  if (
    lower.includes('sight') ||
    lower.includes('museum') ||
    lower.includes('temple') ||
    lower.includes('church') ||
    lower.includes('landmark') ||
    lower.includes('view')
  ) {
    return 'SightSeeing'
  }
  return 'Leisure'
}

function toYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Parse "9:00 AM", "14:30", "2:30 PM" against a calendar day (local).
 */
export function parseSlotTime(dayDate, timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null
  const t = timeStr.trim()
  const d = new Date(dayDate)
  const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  const ap = m[3]?.toUpperCase()
  if (ap === 'PM' && h < 12) h += 12
  if (ap === 'AM' && h === 12) h = 0
  d.setHours(h, min, 0, 0)
  return d
}

/**
 * Build a single parent event + activity drafts from structured itinerary.
 * Times respect the 5h-ahead rule by anchoring the first slot and bumping overlaps forward.
 */
export function buildItineraryEventDraft(structured, prompt) {
  const activities = buildActivityDraftsFromStructured(structured)
  if (activities.length === 0) return null

  const start = new Date(activities[0].start_time)
  const end = new Date(activities[activities.length - 1].end_time)
  const paddedEnd = new Date(end.getTime() + 30 * 60 * 1000)

  const promptTitle = (prompt || '').trim()
  const titleBase = promptTitle
    ? promptTitle.split(/\s+/).slice(0, 6).join(' ')
    : 'Generated itinerary'

  const title = `${titleBase}${titleBase.endsWith('.') ? '' : ''}`

  return {
    title: title.length > 60 ? `${title.slice(0, 57)}…` : title,
    venue: 'AI itinerary',
    location: 'Cebu City',
    price: '—',
    date: toYmd(start),
    category: 'Leisure',
    start_datetime: start.toISOString(),
    end_datetime: paddedEnd.toISOString(),
    latitude: null,
    longitude: null,
  }
}

export function buildActivityDraftsFromStructured(structured) {
  const days = structured?.days
  if (!Array.isArray(days) || days.length === 0) return []

  const minStart = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const tripStart = new Date()
  tripStart.setDate(tripStart.getDate() + 1)
  tripStart.setHours(0, 0, 0, 0)

  let cursor = new Date(Math.max(tripStart.getTime(), minStart.getTime()))
  cursor = new Date(Math.ceil(cursor.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000))

  const drafts = []

  days.forEach((day, dayIdx) => {
    const dayDate = new Date(tripStart)
    dayDate.setDate(dayDate.getDate() + dayIdx)

    ;(day.slots || []).forEach((slot, slotIdx) => {
      let start = parseSlotTime(dayDate, slot.time)
      if (!start || Number.isNaN(start.getTime())) {
        start = new Date(dayDate)
        start.setHours(9 + slotIdx * 2, 0, 0, 0)
      }
      if (start < cursor) start = new Date(cursor)

      const end = new Date(start.getTime() + 90 * 60 * 1000)
      cursor = new Date(end.getTime() + 30 * 60 * 1000)

      const location = (slot.location || 'Cebu City').toString().slice(0, 500)
      const notes = (slot.notes || '').toString()
      const cost = slot.estimatedCostPHP ?? slot.price ?? ''
      const cat = normalizeItineraryCategory(slot.category)
      const activityName = (slot.title || 'Activity').toString().slice(0, 200)

      drafts.push({
        activity_name: activityName,
        location,
        description: [notes, cost ? `Estimated cost: ${String(cost).slice(0, 80)}` : ''].filter(Boolean).join('\n'),
        category: cat,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        latitude: null,
        longitude: null,
      })
    })
  })

  return drafts
}

export function readPendingItinerary() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(PENDING_ITINERARY_STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (data?.v !== PENDING_ITINERARY_VERSION || !data.structured) return null
    return data
  } catch {
    return null
  }
}

export function writePendingItinerary(payload) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(
    PENDING_ITINERARY_STORAGE_KEY,
    JSON.stringify({
      v: PENDING_ITINERARY_VERSION,
      createdAt: new Date().toISOString(),
      ...payload,
    })
  )
}

export function clearPendingItinerary() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(PENDING_ITINERARY_STORAGE_KEY)
}

/** Avoid open redirects: only allow same-app relative paths. */
export function safeAppPath(raw, fallback = '/dashboard') {
  if (typeof raw !== 'string') return fallback
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return fallback
  return t
}

export const PLAN_IMPORT_PATH = '/plan'

export function formatItineraryForCopy(structured, prompt) {
  const lines = []
  if (prompt) lines.push(`Trip prompt: ${prompt}`, '')
  const days = structured?.days || []
  days.forEach((day) => {
    lines.push(day.dayLabel || 'Day')
    ;(day.slots || []).forEach((slot) => {
      const t = slot.time || '—'
      const cat = slot.category ? ` [${slot.category}]` : ''
      lines.push(`  • ${t} — ${slot.title || 'Activity'}${cat}`)
      if (slot.location) lines.push(`    ${slot.location}`)
      if (slot.notes) lines.push(`    ${slot.notes}`)
    })
    lines.push('')
  })
  return lines.join('\n').trim()
}
