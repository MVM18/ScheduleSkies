import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client (server only). Prefer when SUPABASE_SERVICE_ROLE_KEY is set.
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function getBearerToken(req) {
  const authHeader = req.headers.authorization || ''
  return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
}

/**
 * Resolves the signed-in user from the Bearer token, then returns a Supabase client:
 * - Service role when SUPABASE_SERVICE_ROLE_KEY is set (bypasses RLS; still scope by user.id).
 * - Otherwise anon key + Authorization header (RLS as the user) so saves work without the service key.
 */
export async function requireUserFromRequest(req) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const token = getBearerToken(req)

  if (!token) {
    return { error: 'Unauthorized', status: 401 }
  }
  if (!url) {
    return { error: 'Missing NEXT_PUBLIC_SUPABASE_URL.', status: 500 }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    const db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) {
      return { error: 'Invalid or expired session.', status: 401 }
    }
    return { user, db, usingServiceRole: true }
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!anonKey) {
    return { error: 'Missing NEXT_PUBLIC_SUPABASE_ANON_KEY.', status: 500 }
  }

  const db = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) {
    return { error: 'Invalid or expired session.', status: 401 }
  }

  return { user, db, usingServiceRole: false }
}
