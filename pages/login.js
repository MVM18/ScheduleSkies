import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/styles/auth.module.css'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)

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

    router.push('/')
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
            <span className={styles.brandName}>Schedule Skies</span>
          </div>

          <h1 className={styles.heading}>Welcome back</h1>
          <p className={styles.subheading}>Log in to continue planning smarter trips.</p>

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
              <input
                id="password"
                type="password"
                className={styles.input}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>

            {errorMessage ? (
              <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>
            ) : null}

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>

          <p className={styles.footerText}>
            Don&apos;t have an account? <Link href="/signup" className={styles.link}>Sign up</Link>
          </p>
        </section>
      </main>
    </>
  )
}
