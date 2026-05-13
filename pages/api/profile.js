import { createClient } from '@supabase/supabase-js';

<<<<<<< HEAD
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
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim();

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
  // Per-request client so PostgREST runs as this user (RLS sees auth.uid()).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
=======
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify token and get user
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
>>>>>>> parent of dc7bc6e (Profile Page Revamp)
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (req.method === 'GET') {
<<<<<<< HEAD
      const [{ data: profile, error: profileError }, { data: events }] = await Promise.all([
        db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        db.from('events').select('*').eq('user_id', user.id).order('date', { ascending: true }),
      ])
=======
      // Fetch complete profile with relations
>>>>>>> parent of dc7bc6e (Profile Page Revamp)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      const { data: locations } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id);

      const { data: itineraries } = await supabase
        .from('saved_itineraries')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true });

      const { data: analytics } = await supabase
        .from('user_analytics')
        .select('*')
        .eq('user_id', user.id)
        .single();

      return res.status(200).json({
        profile: profile || {},
        saved_locations: locations || [],
        saved_itineraries: itineraries || [],
        analytics: analytics || {
          trips_taken: 0,
          places_visited: 0,
          most_visited_city: null
        },
        email: user.email
      });
    }

    if (req.method === 'PUT') {
      // Update profile preferences
      const { full_name, budget_php, environment, pace, email_updates } = req.body;

      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name,
          budget_php: Number(budget_php),
          environment,
          pace,
          email_updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;

<<<<<<< HEAD
      if (!existing) {
        merged.full_name = merged.full_name || user.email?.split('@')[0] || 'User'
      }

      const { data, error } = await db.from('profiles').upsert(merged, { onConflict: 'id' }).select().single()
        saved_locations: locations || [],
        saved_itineraries: itineraries || [],
        analytics: analytics || {
          trips_taken: 0,
          places_visited: 0,
          most_visited_city: null,
        },
        email: user.email,
      });
    }

    if (req.method === 'PUT') {
      const { full_name, email_updates } = req.body;

      const { data, error } = await supabase
        .from('profiles')
        .upsert(
          {
            id: user.id,
            full_name,
            email_updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) throw error

      return res.status(200).json({ success: true, profile: data })
=======
      return res.status(200).json({ success: true, profile: data });
>>>>>>> parent of dc7bc6e (Profile Page Revamp)
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
