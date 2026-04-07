import React from 'react'
import styles from '../styles/traffic.module.css'
import { FaExclamationCircle } from 'react-icons/fa'

export default function TrafficInfo({ incidents = [] }) {
  // incidents: [{level:'heavy'|'moderate',location:''},...]
  return (
    <div className={styles.container}>
      <p className={styles.title}>TRAFFIC INFO</p>
      <div className={styles.traffic_container}>
        {incidents.map((inc, idx) => (
          <div key={idx} className={
            inc.level === 'heavy' ? styles.heavy : styles.moderate
          }>
            <div>
              <FaExclamationCircle className={styles.icon} />
            </div>

            <div>
              <p className={styles.text}>
                {inc.level === 'heavy' ? 'HEAVY TRAFFIC' : 'MODERATE TRAFFIC'}
              </p>
              <p className={styles.location}>{inc.location}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
