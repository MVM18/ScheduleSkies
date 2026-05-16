// pages/api/share/request-access.js
// POST  — collaborator/viewer requests edit access from the owner
// GET   — owner fetches pending access requests for their events
// PATCH — owner approves/denies a request
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getUserSupabase(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  return createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
}

export default async function handler(req, res) {
  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Missing Supabase server credentials.' });
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

  // POST — request edit access
  if (req.method === 'POST') {
    const { share_id, requester_name, message } = req.body;
    if (!share_id) return res.status(400).json({ error: 'share_id required' });

    // Get requester user id if signed in
    let requesterId = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const userSupa = getUserSupabase(req);
      const { data: { user } } = await userSupa.auth.getUser();
      if (user) requesterId = user.id;
    }

    // Verify share exists
    const { data: share } = await adminSupabase
      .from('event_shares')
      .select('id, event_id, owner_id')
      .eq('id', share_id)
      .single();

    if (!share) return res.status(404).json({ error: 'Share not found' });

    // Check if request already exists
    const query = adminSupabase
      .from('access_requests')
      .select('id, status')
      .eq('share_id', share_id);

    if (requesterId) {
      query.eq('requester_id', requesterId);
    } else {
      query.eq('requester_name', requester_name || 'Guest');
    }

    const { data: existing } = await query.maybeSingle();
    if (existing && existing.status === 'pending') {
      return res.status(200).json({ message: 'Request already submitted', request: existing });
    }

    const { data: request, error } = await adminSupabase
      .from('access_requests')
      .insert([{
        share_id,
        event_id: share.event_id,
        owner_id: share.owner_id,
        requester_id: requesterId,
        requester_name: requester_name || 'Guest',
        message: message || null,
        status: 'pending',
      }])
      .select()
      .single();

    if (error) {
      console.error('Access request insert error:', error);
      return res.status(500).json({ error: 'Failed to submit request' });
    }

    return res.status(200).json({ message: 'Request submitted', request });
  }

  // GET — owner fetches access requests for their events
  if (req.method === 'GET') {
    const userSupa = getUserSupabase(req);
    const { data: { user } } = await userSupa.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { event_id } = req.query;
    const query = adminSupabase
      .from('access_requests')
      .select('*, event_shares(event_id, token, role)')
      .eq('owner_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (event_id) query.eq('event_id', event_id);

    const { data: requests, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ requests: requests || [] });
  }

  // PATCH — owner approves or denies
  if (req.method === 'PATCH') {
    const userSupa = getUserSupabase(req);
    const { data: { user } } = await userSupa.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { request_id, action } = req.body; // action: 'approve' | 'deny'
    if (!request_id || !['approve', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'request_id and action (approve/deny) required' });
    }

    const { data: request } = await adminSupabase
      .from('access_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.owner_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    if (action === 'approve') {
      // Upgrade the share link role to 'edit'
      await adminSupabase
        .from('event_shares')
        .update({ role: 'edit' })
        .eq('id', request.share_id);

      // If requester has a user_id, ensure they're a collaborator
      if (request.requester_id) {
        const { data: existingCollab } = await adminSupabase
          .from('share_collaborators')
          .select('id')
          .eq('share_id', request.share_id)
          .eq('user_id', request.requester_id)
          .maybeSingle();

        if (!existingCollab) {
          await adminSupabase.from('share_collaborators').insert([{
            share_id: request.share_id,
            user_id: request.requester_id,
            guest_label: request.requester_name,
          }]);
        }
      }
    }

    await adminSupabase
      .from('access_requests')
      .update({ status: action === 'approve' ? 'approved' : 'denied' })
      .eq('id', request_id);

    return res.status(200).json({ success: true, action });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
