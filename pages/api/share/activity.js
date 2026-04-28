// pages/api/share/activity.js
// POST/PUT/DELETE — collaborator modifies activities via share token (edit role only)
import { supabase } from '../../../lib/supabaseClient';

async function verifyShareToken(token) {
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
  const { token } = req.query;
  const share = await verifyShareToken(token);

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

    const { data, error } = await supabase
      .from('itinerary_activities')
      .insert([{
        event_id,
        user_id: share.owner_id, // attributed to owner for RLS; collaborator tracked via share
        activity_name,
        description: description || null,
        start_time: new Date(start_time).toISOString(),
        end_time: new Date(end_time).toISOString(),
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
    if (start_time !== undefined) updates.start_time = new Date(start_time).toISOString();
    if (end_time !== undefined) updates.end_time = new Date(end_time).toISOString();
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
