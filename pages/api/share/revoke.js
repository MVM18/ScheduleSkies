// pages/api/share/revoke.js
// DELETE — owner revokes (deletes) a share
// GET    — owner lists all shares for an event
import { createClient } from '@supabase/supabase-js';

function getSupabaseForRequest(req) {
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace('Bearer ', '').trim();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
    }
  );
}

export default async function handler(req, res) {
  const supabase = getSupabaseForRequest(req);

  // Verify auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  // GET — list all shares for an event
  if (req.method === 'GET') {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });

    const { data: shares, error } = await supabase
      .from('event_shares')
      .select(`
        *,
        share_collaborators ( user_id, guest_label, joined_at )
      `)
      .eq('event_id', event_id)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('List shares error:', error);
      return res.status(500).json({ error: 'Failed to list shares' });
    }

    const protocol = req.headers['x-forwarded-proto'] || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${req.headers.host}`;
    const sharesWithUrls = (shares || []).map(s => ({
      ...s,
      share_url: `${baseUrl}/shared/${s.token}`,
    }));

    return res.status(200).json({ shares: sharesWithUrls });
  }

  // DELETE — revoke a share by share id
  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });

    // Verify ownership before deleting
    const { data: share, error: fetchError } = await supabase
      .from('event_shares')
      .select('id, owner_id')
      .eq('id', id)
      .single();

    if (fetchError || !share) return res.status(404).json({ error: 'Share not found' });
    if (share.owner_id !== user.id) return res.status(403).json({ error: 'Not authorized' });

    const { error } = await supabase
      .from('event_shares')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Revoke share error:', error);
      return res.status(500).json({ error: 'Failed to revoke share' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
