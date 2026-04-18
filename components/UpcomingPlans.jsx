import React, { useEffect, useState } from 'react'
import styles from '../styles/upcoming.module.css'
import { FaMapMarkerAlt } from 'react-icons/fa'
import { supabase } from '../lib/supabaseClient';

export default function UpcomingPlans({ plans = [] }) {
  const [eventData, setEventData] = useState([]);

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data && !error) {
      setEventData(data);
    }
  };

  useEffect(()=>{
      fetchEvents();
    },[])

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p>UPCOMING PLANS</p>
        <a href="#" className={styles.view_all}>View All →</a>
      </div>

      <ul className={styles.list}>
        {eventData.map((event) => (
          <li key={event.id} className={styles.plan}>
            <div className={styles.event}>

              <div className={styles.date_and_time}>
                <div className={styles.date}>{event.date}</div>
                <div className={styles.time}>{event.time}</div>
              </div>

              <div className={styles.title_and_location}>
                <div className={styles.title}>{event.title}</div>
                <div className={styles.location}>{event.location}</div>
              </div>

              <div className={styles.distance}>
                {event.distance} away
              </div>

            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}