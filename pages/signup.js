import React, { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { supabase } from '@/lib/supabaseClient'
import styles from '@/styles/auth.module.css'

export default function SignupPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (event) => {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim()
        }
      }
    })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    if (data?.user) {
      setSuccessMessage('Account created. Check your email for confirmation, then log in.')
      setFullName('')
      setEmail('')
      setPassword('')
    }
  }

  return (
    <>
      <Head>
        <title>Sign Up | Schedule Skies</title>
        <meta name="description" content="Create your Schedule Skies account" />
      </Head>

      <main className={styles.authPage}>
        <section className={styles.card}>
          <div className={styles.brandRow}>
            <img src="/images/logo.png" alt="Schedule Skies logo" className={styles.brandLogo} />
            <span className={styles.brandName}>Schedule Skies</span>
          </div>

          <h1 className={styles.heading}>Create account</h1>
          <p className={styles.subheading}>Sign up and start organizing your next trip.</p>

          <form onSubmit={handleSignup} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="fullName" className={styles.label}>Full name</label>
              <input
                id="fullName"
                type="text"
                className={styles.input}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Juan Dela Cruz"
                required
              />
            </div>

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
                placeholder="Create a strong password"
                minLength={6}
                required
              />
            </div>

            {errorMessage ? (
              <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>
            ) : null}

            {successMessage ? (
              <p className={`${styles.message} ${styles.success}`}>{successMessage}</p>
            ) : null}

            <button type="submit" className={styles.primaryBtn} disabled={loading}>
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <p className={styles.footerText}>
            Already have an account? <Link href="/login" className={styles.link}>Log in</Link>
          </p>
        </section>
      </main>
    </>
  )
}
