import { requireUserFromRequest } from '@/lib/supabaseServiceRole'

function eventStatus(ev) {
  const now = new Date()
  const endDate = ev.end_datetime
    ? new Date(ev.end_datetime)
    : ev.date
      ? new Date(`${ev.date}T23:59:59`)
      : null
  const startDate = ev.start_datetime
    ? new Date(ev.start_datetime)
    : ev.date
      ? new Date(`${ev.date}T00:00:00`)
      : null
  if (!endDate && !startDate) return 'upcoming'
  if (endDate && endDate < now) return 'done'
  return 'upcoming'
}

function buildEventSummaries(events) {
  const list = events || []
  const upcoming = list.filter((e) => eventStatus(e) === 'upcoming')
  const past = list.filter((e) => eventStatus(e) === 'done')
  const byCategory = {}
  for (const e of list) {
    const c = e.category || 'Other'
    byCategory[c] = (byCategory[c] || 0) + 1
  }
  let priceTotal = 0
  for (const e of list) {
    const p = parseFloat(e.price)
    if (!Number.isNaN(p)) priceTotal += p
  }
  const sortedUp = [...upcoming].sort((a, b) => {
    const da = a.start_datetime || a.date
    const db = b.start_datetime || b.date
    return new Date(da || 0) - new Date(db || 0)
  })
  return {
    total: list.length,
    upcoming_count: upcoming.length,
    past_count: past.length,
    by_category: byCategory,
    total_price_php: Math.round(priceTotal * 100) / 100,
    next_events: sortedUp.slice(0, 8).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      start_datetime: e.start_datetime,
      category: e.category,
      location: e.location,
    })),
  }
}

export default async function handler(req, res) {
  const auth = await requireUserFromRequest(req)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }
  const { db, user } = auth

  try {
    if (req.method === 'GET') {
      const [{ data: profile, error: profileError }, { data: events }] = await Promise.all([
        db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        db.from('events').select('*').eq('user_id', user.id).order('date', { ascending: true }),
      ])

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError
      }

      const event_summaries = buildEventSummaries(events || [])

      return res.status(200).json({
        profile: profile || {},
        event_summaries,
        email: user.email,
      })
    }

    if (req.method === 'PUT') {
      const body = req.body || {}
      const { data: existing, error: exErr } = await db.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (exErr) throw exErr

      // Only columns present on a minimal Supabase `profiles` table (avoids schema cache errors
      // when optional columns like `environment` were never migrated).
      const merged = {
        id: user.id,
        updated_at: new Date().toISOString(),
      }

      if (existing?.avatar_url != null && existing.avatar_url !== '') {
        merged.avatar_url = existing.avatar_url
      }
      if (body.full_name !== undefined) {
        merged.full_name = typeof body.full_name === 'string' ? body.full_name.trim() : body.full_name
      }
      if (body.avatar_url !== undefined) merged.avatar_url = body.avatar_url

      if (!existing) {
        merged.full_name = merged.full_name || user.email?.split('@')[0] || 'User'
      }

      const { data, error } = await db.from('profiles').upsert(merged, { onConflict: 'id' }).select().single()

      if (error) throw error

      return res.status(200).json({ success: true, profile: data })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Profile API error:', error)
    return res.status(500).json({ error: error.message })
  }
}
