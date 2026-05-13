import React, { useState, useEffect } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { safeAppPath } from '@/lib/itineraryImportShared'
import styles from '@/styles/auth.module.css'
import { FaEye, FaEyeSlash } from 'react-icons/fa'

export default function LoginPage() {
  const router = useRouter()
  const returnTo = typeof router.query.returnTo === 'string' ? router.query.returnTo : ''
  const signupHref = returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetNotice, setResetNotice] = useState('')

  useEffect(() => {
    const q = router.query.reset
    if (q === 'sent') {
      setResetNotice('If an account exists for that email, a reset link is on the way. Log in again after you update your password.')
    } else if (q === 'done') {
      setResetNotice('Your password was updated. You can log in with your new password.')
    } else {
      setResetNotice('')
    }
  }, [router.query.reset])

  const handleLogin = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    const next = safeAppPath(
      typeof router.query.returnTo === 'string' ? router.query.returnTo : '/dashboard',
      '/dashboard'
    )
    router.push(next)
  }

  return (
    <>
      <Head>
        <title>Log In | Schedule Skies</title>
        <meta name="description" content="Log in to your Schedule Skies account" />
      </Head>

      <main className={styles.authPage}>
        <section className={styles.card}>
          <div className={styles.brandRow}>
            <img src="/images/logo.png" alt="Schedule Skies logo" className={styles.brandLogo} />
          </div>

          <h1 className={styles.heading}>Welcome back</h1>
          <p className={styles.subheading}>Log in to continue planning smarter trips.</p>

          {resetNotice ? (
            <p className={`${styles.message} ${styles.success}`} style={{ marginBottom: '0.75rem' }}>
              {resetNotice}
            </p>
          ) : null}

          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="email" className={styles.label}>Email</label>
              <input
                id="email"
                type="email"
                className={styles.input}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password" className={styles.label}>Password</label>
              <div className={styles.passwordWrapper}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={styles.input}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {errorMessage ? (
              <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>
            ) : null}

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <p className={styles.footerText}>
            Don&apos;t have an account? <Link href={signupHref} className={styles.link}>Sign up</Link>
          </p>
        </section>
      </main>
    </>
  )
}
