// pages/api/budget/settle.js
import { createClient } from '@supabase/supabase-js';

function getSupabase(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { global: { headers: token ? { Authorization: `Bearer ${token}` } : {} } }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabase = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const { split_id, is_settled } = req.body;
  if (!split_id) return res.status(400).json({ error: 'split_id required' });

  const { data, error } = await supabase
    .from('expense_splits')
    .update({ is_settled: !!is_settled })
    .eq('id', split_id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ split: data });
}
