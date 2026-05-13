import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import styles from '@/styles/auth.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
        setInvalid(false);
      }
    });

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session) {
        setReady(true);
        setInvalid(false);
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
      if (cancelled) return;
      const { data: { session: s2 } } = await supabase.auth.getSession();
      if (s2) {
        setReady(true);
        setInvalid(false);
      } else {
        setInvalid(true);
      }
    };

    check();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    await supabase.auth.signOut();
    router.replace('/login?reset=done');
  };

  return (
    <>
      <Head>
        <title>Set new password | Schedule Skies</title>
      </Head>
      <main className={styles.authPage}>
        <section className={styles.card}>
          <h1 className={styles.heading}>Set a new password</h1>
          <p className={styles.subheading}>
            Choose a strong password you have not used elsewhere for this account.
          </p>

          {invalid && (
            <p className={`${styles.message} ${styles.error}`}>
              This link is invalid or has expired. Request a new reset email from your profile.
            </p>
          )}

          {invalid && (
            <p style={{ marginTop: '1rem' }}>
              <Link href="/login" className={styles.link}>
                Back to log in
              </Link>
            </p>
          )}

          {ready && !invalid && (
            <form className={styles.form} onSubmit={handleSubmit}>
              {errorMessage && <p className={`${styles.message} ${styles.error}`}>{errorMessage}</p>}
              <div className={styles.field}>
                <label htmlFor="np" className={styles.label}>
                  New password
                </label>
                <input
                  id="np"
                  type="password"
                  className={styles.input}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="npc" className={styles.label}>
                  Confirm password
                </label>
                <input
                  id="npc"
                  type="password"
                  className={styles.input}
                  value={confirm}
                  onChange={(ev) => setConfirm(ev.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className={styles.primaryBtn} disabled={loading}>
                {loading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          )}

          {!ready && !invalid && <p className={styles.subheading}>Checking your reset link…</p>}
        </section>
      </main>
    </>
  );
}
