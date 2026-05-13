import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '')?.trim();

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Per-request client so PostgREST runs as this user (RLS sees auth.uid()).
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    if (req.method === 'GET') {
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

      if (error) throw error;

      return res.status(200).json({ success: true, profile: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
