import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({
      error: 'Missing Supabase server credentials. Set SUPABASE_SERVICE_ROLE_KEY in .env.local.'
    })
  }

  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    return res.status(401).json({ error: 'Missing access token.' })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userError } = await adminClient.auth.getUser(token)

  if (userError || !userData?.user) {
    return res.status(401).json({ error: 'Invalid or expired session.' })
  }

  const userId = userData.user.id

  // Best effort cleanup for app profile table.
  await adminClient.from('profiles').delete().eq('id', userId)

  const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)
  if (deleteError) {
    return res.status(400).json({ error: deleteError.message })
  }

  return res.status(200).json({ ok: true })
}
