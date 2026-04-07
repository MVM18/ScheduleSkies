import React from 'react'
import styles from '../styles/traffic.module.css'
import { FaExclamationCircle } from 'react-icons/fa'

export default function TrafficInfo({ incidents = [] }) {
  // incidents: [{level:'heavy'|'moderate',location:''},...]
  return (
    <div className={styles.container}>
      <p>TRAFFIC INFO</p>
      {incidents.map((inc, idx) => (
        <div key={idx} className={
          inc.level === 'heavy' ? styles.heavy : styles.moderate
        }>
          <FaExclamationCircle className={styles.icon} />
          <span className={styles.text}>{inc.level === 'heavy' ? 'HEAVY TRAFFIC' : 'MODERATE TRAFFIC'}</span>
          <span className={styles.location}>{inc.location}</span>
        </div>
      ))}
    </div>
  )
}
