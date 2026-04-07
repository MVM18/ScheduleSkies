import React from 'react'
import Link from 'next/link'
import styles from '../styles/sidebar.module.css'
import { FaHome, FaCalendarAlt, FaMap, FaUser } from 'react-icons/fa'

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>   
        {/* placeholder logo icon */}
        <img src="/images/logo.png" alt="logo" />
      </div>
      <nav className={styles.nav}>
        <ul>
          <li>
            <Link href="/">
              <FaHome />
            </Link>
          </li>
          <li>
            <Link href="/plan">
              <FaCalendarAlt />
            </Link>
          </li>
          <li>
            <Link href="/map">
              <FaMap />
            </Link>
          </li>
          <li>
            <Link href="/profile">
              <FaUser />
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  )
}
