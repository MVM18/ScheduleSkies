import React, { useEffect, useState } from 'react'
import styles from '../styles/upcoming.module.css'
import { FaMapMarkerAlt } from 'react-icons/fa'
import { supabase } from '../lib/supabaseClient';

export default function UpcomingPlans({ plans = [] }) {
  const [eventData, setEventData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data && !error) {
      setEventData(data);
      setLoading(false);
    }
  };

  function formatTwelveHour(timeString) {
    let [hours, minutes] = timeString.split(':');
    hours = parseInt(hours);
    
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12; // Converts "00" to 12 and "13" to 1
    
    return `${hours}:${minutes} ${ampm}`;
  }

  function formatDate(date) {
    const dateObj = new Date(`${date}T00:00:00`);

    const formattedDate = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    return formattedDate;
  }

  useEffect(()=>{
      fetchEvents();
  },[])

  return (
  <div className={styles.container}>
    <div className={styles.header}>
      <p>UPCOMING PLANS</p>
      <a href="/plan" className={styles.view_all}>View All →</a>
    </div>

    {loading ? (
      <div className="spinner-container">
        <div className="loading-spinner"></div>
      </div>
    ) : eventData.length > 0 ? (
      <ul className={styles.list}>
        {eventData.map((event) => (
          <li key={event.id} className={styles.plan}>
            <div className={styles.event}>
              <div className={styles.date_and_time}>
                <div className={styles.date}>{formatDate(event.date)}</div>
                <div className={styles.time}>{formatTwelveHour(event.time)}</div>
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
    ) : (
      <div className={styles.empty_state}>No upcoming plans found.</div>
    )}
  </div>
);
}