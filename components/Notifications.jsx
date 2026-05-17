import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { FaCloudRain, FaSun, FaExclamationTriangle, FaCalendarAlt, FaTrafficLight } from 'react-icons/fa'
import styles from '../styles/notifications.module.css'

const iconFor = (type) => {
  if (type === 'weather') return <FaCloudRain />
  if (type === 'traffic') return <FaTrafficLight />
  if (type === 'reminder') return <FaCalendarAlt />
  return <FaExclamationTriangle />
}


export default function Notifications({ userId }) {
  const [notes, setNotes] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [loading, setLoading] = useState(true);
  const menuRef = useRef(null)

  useEffect(() => {
    console.log("[Notifications] useEffect fired, userId:", userId);
    if (!userId) {
      console.warn("[Notifications] userId is missing or undefined — skipping fetch");
      return;
    }
    fetchNotes()

    // Real-time: new notifications appear instantly
    const channel = supabase
      .channel('notif_logs')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotes(prev => [payload.new, ...prev])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [userId])

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchNotes() {
    setLoading(true)
    console.log("[fetchNotes] Fetching notifications for user_id:", userId);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error("[fetchNotes] Supabase error:", JSON.stringify(error));
      return;
    }

    console.log(`[fetchNotes] Got ${data?.length ?? 0} notification(s):`, data);
    setNotes(data ?? [])
    setLoading(false)
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotes(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setNotes(prev => prev.map(n => ({ ...n, is_read: true })))
    setMenuOpen(false)
  }

  async function clearRead() {
    await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('is_read', true)
    setNotes(prev => prev.filter(n => !n.is_read))
    setMenuOpen(false)
  }

  const unreadCount = notes.filter(n => !n.is_read).length

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <p className={styles.title}>NOTIFICATIONS</p>
          {unreadCount > 0 && (
            <span className={styles.badge}>{unreadCount}</span>
          )}
        </div>

        {/* 3-dot menu */}
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            className={styles.markAll}
            onClick={() => setMenuOpen(o => !o)}
          >···</button>
          {menuOpen && (
            <div className={styles.dropdown}>
              <button onClick={markAllRead}>Mark all as read</button>
              <button onClick={clearRead}>Clear read</button>
            </div>
          )}
        </div>
      </div>
{loading ? (
      <div className="spinner-container">
        <div className="loading-spinner"></div>
        <p>Getting Notifications...</p>
      </div>
    ) : (
      <>
      <div className={styles.notificationsContainer}>
        {notes.length === 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px',
            textAlign: 'center',
            gap: '8px',
          }}>
            <p style={{ fontSize: '12px', fontWeight: 600 }}>
              You don't have any notifications
            </p>
          </div>
        )}
        {notes.map((n) => (
          <div
            key={n.id}
            className={`${styles.note} ${n.is_read ? styles.read : ''}`}
          >
            <div className={styles.icon}>{iconFor(n.type)}</div>
            <div className={styles.noteBody}>
              <p className={styles.message}>{n.title}</p>
              <p className={styles.detail}>{n.body}</p>
              <p className={styles.time}>
                {new Date(n.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {!n.is_read && (
              <button
                className={styles.readBtn}
                onClick={() => markRead(n.id)}
              >
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  )
}