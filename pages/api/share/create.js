// pages/api/share/create.js
// POST — owner creates a shareable link for an event
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract JWT from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized — missing token' });
    }
    const accessToken = authHeader.replace('Bearer ', '').trim();

    // Create a per-request Supabase client authenticated as this user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      }
    );

    // Verify the session is valid
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized — invalid or expired session' });
    }

    const { event_id, role = 'view', label, expires_in_days } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id is required' });

    // Verify ownership (RLS enforced — query will only return event if user owns it)
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, user_id')
      .eq('id', event_id)
      .single();

    if (eventError || !event) return res.status(404).json({ error: 'Event not found' });
    if (event.user_id !== user.id) return res.status(403).json({ error: 'Not authorized for this event' });

    // Generate a cryptographically secure token
    const shareToken = crypto.randomBytes(20).toString('hex');

    // Calculate expiry
    let expires_at = null;
    if (expires_in_days && parseInt(expires_in_days) > 0) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + parseInt(expires_in_days));
      expires_at = expiry.toISOString();
    }

    const { data: share, error: shareError } = await supabase
      .from('event_shares')
      .insert([{
        event_id,
        owner_id: user.id,
        token: shareToken,
        role: ['view', 'edit'].includes(role) ? role : 'view',
        label: label || `${event.title} — ${role === 'edit' ? 'Collaborator' : 'Viewer'} Link`,
        expires_at,
      }])
      .select()
      .single();

    if (shareError) {
      console.error('Share insert error:', shareError);
      return res.status(500).json({ error: 'Failed to create share: ' + shareError.message });
    }

    // Build share URL — prefer http in dev, https in prod
    const protocol = req.headers['x-forwarded-proto'] || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${req.headers.host}`;
    const share_url = `${baseUrl}/shared/${shareToken}`;

    return res.status(200).json({ share, share_url, token: shareToken });
  } catch (err) {
    console.error('Share create error:', err);
    return res.status(500).json({ error: 'Internal server error: ' + (err.message || err) });
  }
}
