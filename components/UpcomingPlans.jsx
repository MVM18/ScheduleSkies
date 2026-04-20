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
      .order('date', { ascending: true });

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


  function formatTwelveHour(timeString) {
    let [hours, minutes] = timeString.split(':');
    hours = parseInt(hours);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${ampm}`;
  }

  function formatDate(date) {
    const dateObj = new Date(`${date}T00:00:00`);
    return dateObj.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
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
        </div>
      ) : eventData.length > 0 ? (
        <ul className={styles.list}>
          {eventData.map((event) => {
            const distance = getEventDistance(event);
            return (
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
                    {distance !== null ? `${distance} km away` : '—'}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.empty_state}>No upcoming plans found.</div>
      )}
    </div>
  );
}