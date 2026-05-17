import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import AiAssistant from '@/components/AiAssistant'
import { supabase } from '@/lib/supabaseClient'

// global styles must be imported only once in the custom App
import '../styles/globals.css'
import '../styles/navbar.css'
import '../styles/hero.css'
import '../styles/features.css'
import '../styles/plan.css'
import '../styles/dashboard.css'
import '../styles/loading.css';
import '../styles/places-modal.css'

const THEME_STORAGE_KEY = 'schedule-skies-theme'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)

  const protectedPages = ['/dashboard', '/plan', '/map', '/profile']
  const isProtectedPage = protectedPages.includes(router.pathname)

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    const nextTheme = savedTheme === 'dark' ? 'dark' : 'light'
    document.body.setAttribute('data-theme', nextTheme)
  }, [])

  useEffect(() => {
    const handleThemeStorageChange = (event) => {
      if (event.key !== THEME_STORAGE_KEY) return
      const nextTheme = event.newValue === 'dark' ? 'dark' : 'light'
      document.body.setAttribute('data-theme', nextTheme)
    }

    window.addEventListener('storage', handleThemeStorageChange)
    return () => window.removeEventListener('storage', handleThemeStorageChange)
  }, [])

  useEffect(() => {
    let mounted = true

    const enforceAuth = async () => {
      if (!isProtectedPage) {
        if (mounted) setAuthChecked(true)
        return
      }

      const { data: { session } } = await supabase.auth.getSession()

      if (!mounted) return
      if (!session) {
        router.replace('/')
        return
      }
      setAuthChecked(true)
    }

    setAuthChecked(false)
    enforceAuth()

    return () => { mounted = false }
  }, [isProtectedPage, router])

  // Hide AI assistant on login and signup pages
  const hideAiPages = ['/', '/login', '/signup', '/auth/reset-password']
  const showAi = !hideAiPages.includes(router.pathname)

  if (isProtectedPage && !authChecked) {
    return null
  }

  return (
    <>
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#2563eb" />
        <link rel="icon" href="/images/logo.png" />
      </Head>
      <Component {...pageProps} />
      {showAi && <AiAssistant />}
    </>
  )
}
