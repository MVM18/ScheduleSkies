// pages/api/budget/expense.js
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

  if (req.method === 'POST') {
    const { event_id, name, amount, category, paid_by, activity_id, notes, splits } = req.body;
    if (!event_id || !name || !amount) return res.status(400).json({ error: 'event_id, name, amount required' });

    const { data: expense, error } = await supabase.from('event_expenses').insert([{
      event_id, name, amount: parseFloat(amount), category: category || 'Other',
      paid_by: paid_by || 'Unknown', paid_by_id: user.id,
      activity_id: activity_id || null, notes: notes || null, created_by: user.id,
    }]).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Insert splits if provided
    if (splits && splits.length > 0) {
      const splitRows = splits.map(s => ({
        expense_id: expense.id, user_label: s.user_label, amount: parseFloat(s.amount) || 0, user_id: s.user_id || null,
      }));
      await supabase.from('expense_splits').insert(splitRows);
    }

    return res.status(200).json({ expense });
  }

  if (req.method === 'PUT') {
    const { id, name, amount, category, paid_by, activity_id, notes, splits } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (category !== undefined) updates.category = category;
    if (paid_by !== undefined) updates.paid_by = paid_by;
    if (activity_id !== undefined) updates.activity_id = activity_id || null;
    if (notes !== undefined) updates.notes = notes;

    const { data, error } = await supabase.from('event_expenses').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Replace splits if provided
    if (splits) {
      await supabase.from('expense_splits').delete().eq('expense_id', id);
      if (splits.length > 0) {
        const splitRows = splits.map(s => ({
          expense_id: id, user_label: s.user_label, amount: parseFloat(s.amount) || 0, user_id: s.user_id || null,
        }));
        await supabase.from('expense_splits').insert(splitRows);
      }
    }

    return res.status(200).json({ expense: data });
  }

  if (req.method === 'DELETE') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const { error } = await supabase.from('event_expenses').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
