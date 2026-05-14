// pages/api/share/activity.js
// POST/PUT/DELETE — collaborator modifies activities via share token (edit role only)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function verifyShareToken(supabase, token) {
  if (!token) return null;
  const { data: share, error } = await supabase
    .from('event_shares')
    .select('*')
    .eq('token', token)
    .single();
  if (error || !share) return null;
  if (share.expires_at && new Date(share.expires_at) < new Date()) return null;
  if (share.role !== 'edit') return null;
  return share;
}

export default async function handler(req, res) {
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Missing Supabase server credentials. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.',
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { token } = req.query;
  const share = await verifyShareToken(supabase, token);

  if (!share) {
    return res.status(403).json({ error: 'Invalid token, expired, or view-only access' });
  }

  const event_id = share.event_id;

  // POST — create a new activity
  if (req.method === 'POST') {
    const { activity_name, description, start_time, end_time, location, latitude, longitude, sort_order } = req.body;
    if (!activity_name || !start_time || !end_time) {
      return res.status(400).json({ error: 'activity_name, start_time, end_time required' });
    }

    const start = new Date(start_time);
    const end = new Date(end_time);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid start_time or end_time' });
    }
    if (end <= start) {
      return res.status(400).json({ error: 'end_time must be after start_time' });
    }

    const { data, error } = await supabase
      .from('itinerary_activities')
      .insert([{
        event_id,
        user_id: share.owner_id, // attributed to owner for RLS; collaborator tracked via share
        activity_name,
        description: description || null,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        location: location || null,
        latitude: latitude || null,
        longitude: longitude || null,
        sort_order: sort_order || 0,
      }])
      .select()
      .single();

    if (error) {
      console.error('Activity insert error:', error);
      return res.status(500).json({ error: 'Failed to create activity' });
    }
    return res.status(200).json({ activity: data });
  }

  // PUT — update an existing activity
  if (req.method === 'PUT') {
    const { id, activity_name, description, start_time, end_time, location, latitude, longitude } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Verify the activity belongs to this event
    const { data: existing } = await supabase
      .from('itinerary_activities')
      .select('id, event_id')
      .eq('id', id)
      .single();

    if (!existing || existing.event_id !== event_id) {
      return res.status(403).json({ error: 'Activity does not belong to this event' });
    }

    const updates = {};
    if (activity_name !== undefined) updates.activity_name = activity_name;
    if (description !== undefined) updates.description = description;
    if (start_time !== undefined) {
      const parsed = new Date(start_time);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid start_time' });
      updates.start_time = parsed.toISOString();
    }
    if (end_time !== undefined) {
      const parsed = new Date(end_time);
      if (Number.isNaN(parsed.getTime())) return res.status(400).json({ error: 'Invalid end_time' });
      updates.end_time = parsed.toISOString();
    }
    if (location !== undefined) updates.location = location;
    if (latitude !== undefined) updates.latitude = latitude;
    if (longitude !== undefined) updates.longitude = longitude;

    const { data, error } = await supabase
      .from('itinerary_activities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Activity update error:', error);
      return res.status(500).json({ error: 'Failed to update activity' });
    }
    return res.status(200).json({ activity: data });
  }

  // DELETE — remove an activity
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    const { data: existing } = await supabase
      .from('itinerary_activities')
      .select('id, event_id')
      .eq('id', id)
      .single();

    if (!existing || existing.event_id !== event_id) {
      return res.status(403).json({ error: 'Activity does not belong to this event' });
    }

    const { error } = await supabase
      .from('itinerary_activities')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Activity delete error:', error);
      return res.status(500).json({ error: 'Failed to delete activity' });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
