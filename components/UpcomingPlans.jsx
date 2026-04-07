import React from 'react'
import styles from '../styles/upcoming.module.css'
import { FaMapMarkerAlt } from 'react-icons/fa'

export default function UpcomingPlans({ plans = [] }) {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p>UPCOMING PLANS</p>
        <a href="#" className={styles.view_all}>View All →</a>
      </div>
      <ul className={styles.list}>
        {plans.map((p, idx) => (
          <li key={idx} className={styles.plan}>
            <div className={styles.event}>
              <div className={styles.date_and_time}>
                <div className={styles.date}>{p.date}</div>
                <div className={styles.time}>{p.time}</div>
              </div>
              <div className={styles.title_and_location}>
                <div className={styles.title}>{p.title}</div>
                <div className={styles.location}>{p.location}</div>
              </div>
              <div className={styles.distance}>{p.distance} away</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
