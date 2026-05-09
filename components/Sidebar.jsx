import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import styles from '../styles/sidebar.module.css'
import { FaHome, FaCalendarAlt, FaMap, FaUser, FaUserCircle, FaCog, FaSignOutAlt } from 'react-icons/fa'
import HomeIcon from '../public/images/home.svg'
import EventsIcon from '../public/images/events.svg'
import MapIcon from '../public/images/map.svg'
import ProfileIcon from '../public/images/profile.svg'

export default function Sidebar() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data?.user || null)
    }
    fetchUser()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <img src="/images/logo.png" alt="logo" />
      </div>
      <nav className={styles.nav}>
        <ul>
          <li>
            <Link href="/dashboard">
              <div className={`btn ${router.pathname === '/dashboard' ? styles.active : ''}`}>
                <HomeIcon className={styles.icon} fill="currentColor" />
              </div>
            </Link>
          </li>
          <li>
            <Link href="/plan">
              <div className={`btn ${router.pathname === '/plan' ? styles.active : ''}`}>
                <EventsIcon className={styles.icon} fill="currentColor" />
              </div>
            </Link>
          </li>
          <li>
            <Link href="/map">
              <div className={`btn ${router.pathname === '/map' ? styles.active : ''}`}>
                <MapIcon className={styles.icon} fill="currentColor" />
              </div>
            </Link>
          </li>
          <li>
            <Link href="/profile">
              <div className={`btn ${router.pathname === '/profile' ? styles.active : ''}`}>
                <ProfileIcon className={styles.icon} fill="currentColor" />
              </div>
            </Link>
          </li>
        </ul>
      </nav>
      {user && (
        <div className={styles.quickMenuContainer}>
          {isOpen && (
            <div className={styles.quickMenuDropdown}>
              <Link href="/profile" className={styles.dropdownItem}>
                <FaCog /> Settings
              </Link>
              <button onClick={handleLogout} className={styles.dropdownItemDanger}>
                <FaSignOutAlt /> Log Out
              </button>
            </div>
          )}
          <button 
            className={styles.quickMenuBtn}
            onClick={() => setIsOpen(!isOpen)}
          >
            <FaUserCircle />
          </button>
        </div>
      )}
    </aside>
  )
}
