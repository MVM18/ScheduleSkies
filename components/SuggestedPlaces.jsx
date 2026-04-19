import React, { useEffect, useState } from 'react'
import styles from '../styles/suggested.module.css'
import { FaStar } from 'react-icons/fa'
import { getLocationWithFallback } from '@/lib/getLocation'

export default function SuggestedPlaces({ places = [] }) {
  const [loading, setLoading] = useState(true);
  const [placesData, setPlacesData] = useState([]);
  const [error, setError] = useState(null);

  const searchNearbyPlaces = async () => {
    try {
      setLoading(true);
      setError(null);

      const { lat, lon } = await getLocationWithFallback();

      const params = new URLSearchParams({
        ll: `${lat},${lon}`,
        radius: '1000',
        limit: '10'
      });

      const response = await fetch(`/api/places?${params}`, {
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      setPlacesData(data.places ?? []);
    } catch (error) {
      console.error('Google Places Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getFoursquarePhoto = (photos, size = '300x300') => {
    if (!photos || photos.length === 0) {
      return `https://placehold.co/${size.split('x')[0] || 300}?text=No+Image`;
    }
    const { prefix, suffix } = photos[0];
    return `${prefix}${size}${suffix}`;
  };

  const getGooglePhoto = (photos) => {
    if (!photos || photos.length === 0) {
      return 'https://placehold.co/400?text=No+Image';
    }
    const photoName = photos[0].name;
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  };

  useEffect(() => {
    searchNearbyPlaces();
  }, []);

  return (
    <div className={styles.container}>
      <p className={styles.main_title}>SUGGESTED PLACES</p>
      <div className={styles.places_container}>
        {loading ? (
          <div className="spinner-container">
            <div className="loading-spinner"></div>
          </div>
        ) : error ? (
          <p>Failed to load places.</p>
        ) : placesData.length === 0 ? (
          <p>No places found nearby.</p>
        ) : (
          placesData.map((place) => (
            <div key={place.id} className={styles.card}>
              <img
                src={getGooglePhoto(place.photos)}
                alt={place.displayName?.text}
                className={styles.image}
              />
              <div className={styles.info}>
                <h4 className={styles.title}>{place.displayName?.text}</h4>
                <p className={styles.description}>{place.formattedAddress}</p>
                <div className={styles.rating}>
                  <FaStar className={styles.star} /> {place.rating ?? 'N/A'} ({place.userRatingCount})
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}