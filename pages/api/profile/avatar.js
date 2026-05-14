import { requireUserFromRequest } from '@/lib/supabaseServiceRole'

const MAX_BYTES = 2 * 1024 * 1024
const BUCKET = 'avatars'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = await requireUserFromRequest(req)
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error })
  }
  const { user, db, usingServiceRole } = auth

  if (req.method === 'DELETE') {
    const ext = ['jpg', 'jpeg', 'png', 'webp']
    await Promise.all(
      ext.map((e) => db.storage.from(BUCKET).remove([`${user.id}/avatar.${e}`]).catch(() => null))
    )
    await db
      .from('profiles')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    return res.status(200).json({ avatar_url: null })
  }

  const { imageBase64, contentType = 'image/jpeg' } = req.body || {}
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Missing imageBase64' })
  }

  const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
  let buffer
  try {
    buffer = Buffer.from(base64, 'base64')
  } catch {
    return res.status(400).json({ error: 'Invalid image data' })
  }

  if (buffer.length > MAX_BYTES) {
    return res.status(400).json({ error: 'Image too large (max 2MB).' })
  }

  const ext = String(contentType).includes('png')
    ? 'png'
    : String(contentType).includes('webp')
      ? 'webp'
      : 'jpg'
  const path = `${user.id}/avatar.${ext}`

  const { error: upErr } = await db.storage.from(BUCKET).upload(path, buffer, {
    contentType: String(contentType).split(';')[0] || 'image/jpeg',
    upsert: true,
  })

  if (upErr) {
    console.error('Avatar upload:', upErr)
    const hint = usingServiceRole
      ? 'Create a public "avatars" bucket in Supabase Storage (see SUPABASE_SCHEMA_UPDATES.sql).'
      : 'Avatar upload usually needs SUPABASE_SERVICE_ROLE_KEY, or add Storage policies so authenticated users can upload to the avatars bucket.'
    return res.status(500).json({ error: upErr.message, hint })
  }

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path)
  const avatarUrl = pub?.publicUrl

  await db
    .from('profiles')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  return res.status(200).json({ avatar_url: avatarUrl })
}
