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
        throw new Error(`Server error ${response.status}`);
      }

      const data = await response.json();

      // API always returns { places: [] } now — no throw on empty
      setPlacesData(data.places ?? []);
    } catch (err) {
      console.error('Places error:', err);
      setError(err.message || 'Could not load nearby places');
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
          /* Premium error state — no crash, no bare text */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 20px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '16px',
            border: '1px dashed rgba(255,255,255,0.2)',
            backdropFilter: 'blur(6px)',
            gap: '10px',
          }}>
            <span style={{ fontSize: '36px' }}>🗺️</span>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>
              Nearby places unavailable
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.55)', maxWidth: '200px' }}>
              Place suggestions require a Google Places API key.
            </p>
            <button
              onClick={searchNearbyPlaces}
              style={{
                marginTop: '6px',
                padding: '7px 16px',
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '10px',
                color: 'white',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s',
              }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              ↺ Retry
            </button>
          </div>
        ) : placesData.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '24px',
            textAlign: 'center',
            gap: '8px',
          }}>
            <p style={{ fontSize: '12px', fontWeight: 600 }}>
              No places found nearby...
            </p>
          </div>
        ) : (
          placesData.map((place) => (
            <div key={place.id} className={styles.card}>
              <img
                src={getGooglePhoto(place.photos)}
                alt={place.displayName?.text}
                className={styles.image}
                onError={e => { e.currentTarget.src = 'https://placehold.co/400?text=No+Image'; }}
              />
              <div className={styles.info}>
                <h4 className={styles.title}>{place.displayName?.text}</h4>
                <p className={styles.description}>{place.formattedAddress}</p>
                <div className={styles.rating}>
                  <FaStar className={styles.star} /> {place.rating ?? 'N/A'} ({place.userRatingCount ?? 0})
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}