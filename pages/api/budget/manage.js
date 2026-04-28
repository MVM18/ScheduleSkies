// pages/api/budget/manage.js
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
  const supabase = getSupabase(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const { event_id } = req.query;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });

    const { data: budget } = await supabase.from('event_budgets').select('*').eq('event_id', event_id).single();
    const { data: expenses } = await supabase.from('event_expenses').select('*').eq('event_id', event_id).order('date', { ascending: false });
    const expenseIds = (expenses || []).map(e => e.id);
    let splits = [];
    if (expenseIds.length > 0) {
      const { data } = await supabase.from('expense_splits').select('*').in('expense_id', expenseIds);
      splits = data || [];
    }
    const { data: shares } = await supabase.from('event_shares').select('id, share_collaborators(user_id, guest_label)').eq('event_id', event_id);
    const participants = new Set();
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    if (profile?.full_name) participants.add(profile.full_name);
    if (shares) shares.forEach(s => (s.share_collaborators || []).forEach(c => { if (c.guest_label) participants.add(c.guest_label); }));

    return res.status(200).json({
      budget: budget || { total: 0, currency: '₱' },
      expenses: expenses || [],
      splits,
      participants: Array.from(participants),
    });
  }

  if (req.method === 'POST') {
    const { event_id, total, currency } = req.body;
    if (!event_id) return res.status(400).json({ error: 'event_id required' });
    const { data: existing } = await supabase.from('event_budgets').select('id').eq('event_id', event_id).single();
    if (existing) {
      const { data, error } = await supabase.from('event_budgets').update({ total: parseFloat(total) || 0, currency: currency || '₱' }).eq('id', existing.id).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ budget: data });
    } else {
      const { data, error } = await supabase.from('event_budgets').insert([{ event_id, total: parseFloat(total) || 0, currency: currency || '₱' }]).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ budget: data });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
