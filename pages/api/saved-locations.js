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
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return res.status(200).json({ locations: data })
    }

    if (req.method === 'POST') {
      const { name, type, description, latitude, longitude } = req.body

      if (!name || !type) {
        return res.status(400).json({ error: 'Name and type are required' })
      }

      const { data, error } = await db
        .from('saved_locations')
        .insert({
          user_id: user.id,
          name,
          type,
          description,
          latitude,
          longitude,
        })
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return res.status(400).json({ error: 'Location with this name already exists' })
        }
        throw error
      }

      return res.status(201).json({ success: true, location: data })
    }

    if (req.method === 'DELETE') {
      const { id } = req.body

      if (!id) {
        return res.status(400).json({ error: 'Location ID is required' })
      }

      const { data: location, error: fetchError } = await db
        .from('saved_locations')
        .select('user_id')
        .eq('id', id)
        .single()

      if (fetchError || !location || location.user_id !== user.id) {
        return res.status(403).json({ error: 'Forbidden' })
      }

      const { error } = await db.from('saved_locations').delete().eq('id', id)

      if (error) throw error
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('Saved locations API error:', error)
    return res.status(500).json({ error: error.message })
  }
}
