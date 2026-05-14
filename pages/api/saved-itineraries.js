import { requireUserFromRequest } from '@/lib/supabaseServiceRole'

export default async function handler(req, res) {
  const auth = await requireUserFromRequest(req)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }
  const { db, user } = auth

  try {
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('saved_itineraries')
        .select('*')
        .eq('user_id', user.id)
        .order('start_date', { ascending: true })

      if (error) throw error
      return res.status(200).json({ itineraries: data })
    }

    if (req.method === 'POST') {
      const { name, description, start_date, end_date, budget_php, status } = req.body

      if (!name || !start_date || !end_date) {
        return res.status(400).json({ error: 'Name, start_date, and end_date are required' })
      }

      const { data, error } = await db
        .from('saved_itineraries')
        .insert({
          user_id: user.id,
          name,
          description,
          start_date,
          end_date,
          budget_php: budget_php ? Number(budget_php) : null,
          status: status || 'planned',
        })
        .select()
        .single()

      if (error) throw error
      return res.status(201).json({ success: true, itinerary: data })
    }

    if (req.method === 'PUT') {
      const { id, name, description, start_date, end_date, budget_php, status } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Itinerary ID is required' })
      }

      const { data: itinerary, error: fetchError } = await db
        .from('saved_itineraries')
        .select('user_id')
        .eq('id', id)
        .single()

      if (fetchError || !itinerary || itinerary.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { data, error } = await db
        .from('saved_itineraries')
        .update({
          name,
          description,
          start_date,
          end_date,
          budget_php: budget_php ? Number(budget_php) : null,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ success: true, itinerary: data })
    }

    if (req.method === 'DELETE') {
      const { id } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Itinerary ID is required' })
      }

      const { data: itinerary, error: fetchError } = await db
        .from('saved_itineraries')
        .select('user_id')
        .eq('id', id)
        .single()

      if (fetchError || !itinerary || itinerary.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { error } = await db.from('saved_itineraries').delete().eq('id', id)

      if (error) throw error
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Saved itineraries API error:', error)
    return res.status(500).json({ error: error.message })
  }
}
