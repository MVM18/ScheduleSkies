import React, { useEffect, useState } from 'react'
import styles from '../styles/upcoming.module.css'
import { FaMapMarkerAlt } from 'react-icons/fa'
import { supabase } from '../lib/supabaseClient';
import { getLocationWithFallback } from '../lib/getLocation';

export default function UpcomingPlans({ plans = [] }) {
  const [eventData, setEventData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true })
      .gte('start_datetime', new Date().toISOString());

    if (data && !error) {
      setEventData(data);
    }
    setLoading(false);
  };

  const fetchUserLocation = async () => {
    const coords = await getLocationWithFallback();
    setUserLocation(coords);
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1); // Returns distance in km, 1 decimal
  };


  function formatDateTime(datetime) {
    const d = new Date(datetime);

    const date = d.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return { date, time };
  }

  function getEventDistance(event) {
    if (!userLocation || !event.latitude || !event.longitude) return null;
    return calculateDistance(
      userLocation.lat,
      userLocation.lon,
      event.latitude,
      event.longitude
    );
  }

  useEffect(() => {
    fetchEvents();
    fetchUserLocation();
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p>UPCOMING PLANS</p>
        <a href="/plan" className={styles.view_all}>View All →</a>
      </div>

      {loading ? (
        <div className="spinner-container">
          <div className="loading-spinner"></div>
          <p>Getting plans...</p>
        </div>
      ) : eventData.length > 0 ? (
        <ul className={styles.list}>
          {eventData.map((event) => {
            const distance = getEventDistance(event);
            const { date, time } = formatDateTime(event.start_datetime);
            return (
              <li key={event.id} className={styles.plan}>
                <div className={styles.event}>
                  <div className={styles.date_and_time}>
                    <div className={styles.date}>{date}</div>
                    <div className={styles.time}>{time}</div>
                  </div>
                  <div className={styles.title_and_location}>
                    <div className={styles.title}>{event.title}</div>
                    <div className={styles.location}>{event.location}</div>
                  </div>
                  <div className={styles.distance}>
                    {distance !== null ? `${distance} km away` : '—'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px',
            textAlign: 'center',
            gap: '8px',
          }}>
            <p style={{ fontSize: '12px', fontWeight: 600 }}>
              No upcoming plans found...
            </p>
          </div>
      )}
    </div>
  );
}