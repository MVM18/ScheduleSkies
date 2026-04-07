import React from 'react'
import styles from '../styles/forecast.module.css'
import { WiDaySunny, WiCloud } from 'react-icons/wi'

export default function ForecastCards({ hours = [] }) {
  // sample structure: [{time:'8 AM',icon:'sun',temp:28},...]
  return (
    <div className={styles.container}>
      <p>TODAY'S FORECAST</p>
      <div className={styles.cardContainer}>
        {hours.map((h, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.time}>{h.time}</div>
            <div className={styles.icon}>
              {h.icon === 'sun' ? <WiDaySunny /> : <WiCloud />}
            </div>
            <div className={styles.temp}>{h.temp}°C</div>
          </div>
        ))}
      </div>
    </div>
  )
}
