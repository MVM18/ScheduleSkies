import React from 'react'
import styles from '../styles/notifications.module.css'
import { FaCloudRain, FaSun } from 'react-icons/fa'

export default function Notifications({ notes = [] }) {
  // notes: [{type:'rain'|'heat',message:'',detail:''},...]
  const iconFor = (type) => {
    if (type === 'rain') return <FaCloudRain />
    if (type === 'heat') return <FaSun />
    return null
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Notifications</h3>
        <button className={styles.markAll}>Mark All Read ✓</button>
      </div>
      {notes.map((n, idx) => (
        <div key={idx} className={styles.note}>
          <div className={styles.icon}>{iconFor(n.type)}</div>
          <div>
            <p className={styles.message}>{n.message}</p>
            <p className={styles.detail}>{n.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
