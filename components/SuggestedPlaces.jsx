import React from 'react'
import styles from '../styles/suggested.module.css'
import { FaStar } from 'react-icons/fa'

export default function SuggestedPlaces({ places = [] }) {
  return (
    <div className={styles.container}>
      <p className={styles.main_title}>SUGGESTED PLACES</p>
      <div className={styles.places_container}>
        {places.map((p, idx) => (
          <div key={idx} className={styles.card}>
            <img src={p.image} alt={p.name} className={styles.image} />
            <div className={styles.info}>
              <h4 className={styles.title}>{p.name}</h4>
              <p className={styles.description}>{p.description}</p>
              <div className={styles.rating}>
                <FaStar className={styles.star} /> {p.rating} ({p.reviews})
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
