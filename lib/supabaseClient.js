import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables. Using mock client to allow fallback data.');
}

// Export a real client if keys exist, otherwise export a mock client that triggers our fallback data safely.
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: { 
        getSession: async () => ({ data: { session: null }, error: new Error('Missing Supabase environment variables') }) 
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: new Error('Missing Supabase environment variables') })
          })
        })
      })
    };
