// pages/api/share/get.js
// GET ?token=xxx — public endpoint, returns full event + itinerary for a valid token
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Missing Supabase server credentials. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.',
    });
  }

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token is required' });

  try {
    // Server-side client bypasses RLS; token validation below controls access.
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Fetch share record
    const { data: share, error: shareError } = await supabase
      .from('event_shares')
      .select('*')
      .eq('token', token)
      .single();

    if (shareError || !share) {
      return res.status(404).json({ error: 'Share not found or invalid link' });
    }

    // 2. Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This share link has expired' });
    }

    // 3. Fetch event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', share.event_id)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // 4. Fetch activities sorted by start_time
    const { data: activities, error: activitiesError } = await supabase
      .from('itinerary_activities')
      .select('*')
      .eq('event_id', share.event_id)
      .order('start_time', { ascending: true });

    if (activitiesError) {
      console.error('Activities fetch error:', activitiesError);
    }

    // 5. Fetch owner profile (just full_name, not sensitive)
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', share.owner_id)
      .single();

    // 6. Fetch collaborators who have joined
    const { data: collaborators } = await supabase
      .from('share_collaborators')
      .select('user_id, guest_label, joined_at')
      .eq('share_id', share.id)
      .order('joined_at', { ascending: true });

    return res.status(200).json({
      share: {
        id: share.id,
        token: share.token,
        role: share.role,
        label: share.label,
        expires_at: share.expires_at,
      },
      event,
      activities: activities || [],
      ownerName: ownerProfile?.full_name || 'A ScheduleSkies user',
      collaborators: collaborators || [],
    });
  } catch (err) {
    console.error('Share get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
