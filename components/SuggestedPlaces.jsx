import React, { useEffect, useState, useCallback } from 'react'
import styles from '../styles/suggested.module.css'
import { FaStar, FaTimes, FaChevronLeft, FaChevronRight, FaMapMarkerAlt, FaClock } from 'react-icons/fa'
import { getLocationWithFallback } from '@/lib/getLocation'
import { useRouter } from 'next/router'

/* ─── Place Detail Modal ─────────────────────────────────────────── */
function PlaceModal({ place, onClose }) {
  const router = useRouter()
  const [activePhoto, setActivePhoto] = useState(0);

  const photos = place.photos ?? [];
  const reviews = place.reviews ?? [];
  const totalPhotos = photos.length;

  const getGooglePhoto = (photo, size = 800) => {
    if (!photo) return 'https://placehold.co/800x500?text=No+Image';
    return `https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${size}&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  };

  const handleDirections = () => {
    const lat = place.location?.latitude
    const lng = place.location?.longitude
    const label = place.displayName?.text ?? ''
    onClose()
    if (lat && lng) {
      router.push(`/map?lat=${lat}&lng=${lng}&label=${encodeURIComponent(label)}`)
    } else {
      router.push(`/map?label=${encodeURIComponent(label)}`)
    }
  }

  const prev = useCallback(() =>
    setActivePhoto(i => (i - 1 + totalPhotos) % totalPhotos), [totalPhotos]);
  const next = useCallback(() =>
    setActivePhoto(i => (i + 1) % totalPhotos), [totalPhotos]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, i) => (
      <FaStar key={i} className={i < Math.round(rating) ? 'star-filled' : 'star-empty'} />
    ));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Close */}
        <button className="modal-close-btn" onClick={onClose}>
          <FaTimes />
        </button>

        {/* Gallery */}
        <div className="modal-gallery">
          <img
            src={getGooglePhoto(photos[activePhoto])}
            alt={place.displayName?.text}
            className="modal-main-photo"
            onError={e => { e.currentTarget.src = 'https://placehold.co/800x500?text=No+Image'; }}
          />

          <div className="modal-photo-gradient" />

          {totalPhotos > 1 && (
            <>
              <button className="modal-arrow modal-arrow-left" onClick={prev}>
                <FaChevronLeft />
              </button>
              <button className="modal-arrow modal-arrow-right" onClick={next}>
                <FaChevronRight />
              </button>
              <div className="modal-photo-count">{activePhoto + 1} / {totalPhotos}</div>
            </>
          )}

          {totalPhotos > 1 && (
            <div className="modal-thumb-strip">
              {photos.slice(0, 8).map((photo, i) => (
                <img
                  key={i}
                  src={getGooglePhoto(photo, 120)}
                  alt=""
                  onClick={() => setActivePhoto(i)}
                  className={`modal-thumb ${i === activePhoto ? 'active' : ''}`}
                  onError={e => { e.currentTarget.src = 'https://placehold.co/120?text=?'; }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="modal-info">
          <div className="modal-header">
            {place.editorialSummary?.text && (
              <p className="modal-description">{place.editorialSummary.text}</p>
            )}
            <div>
              <h2 className="modal-place-title">{place.displayName?.text}</h2>
              {place.primaryTypeDisplayName?.text && (
                <span className="modal-type-tag">{place.primaryTypeDisplayName.text}</span>
              )}
            </div>
            {place.rating && (
              <div className="modal-rating-badge">
                <div className="modal-stars">{renderStars(place.rating)}</div>
                <span className="modal-rating-score">{place.rating}</span>
                <span className="modal-rating-count">({place.userRatingCount?.toLocaleString() ?? 0})</span>
              </div>
            )}
          </div>

          {/* Address */}
          {place.formattedAddress && (
            <div className="modal-meta-row">
              <FaMapMarkerAlt className="icon-pin" />
              <span>{place.formattedAddress}</span>
            </div>
          )}

          {/* Hours */}
          {place.currentOpeningHours?.openNow !== undefined && (
            <div className="modal-meta-row">
              <FaClock className={`icon-clock ${place.currentOpeningHours.openNow ? 'status-open' : 'status-closed'}`} />
              <span className={place.currentOpeningHours.openNow ? 'status-open' : 'status-closed'}>
                {place.currentOpeningHours.openNow ? 'Open now' : 'Closed'}
              </span>
              {place.currentOpeningHours?.weekdayDescriptions?.[new Date().getDay()] && (
                <span className="modal-hours-detail">
                  · {place.currentOpeningHours.weekdayDescriptions[new Date().getDay()]}
                </span>
              )}
            </div>
          )}

          {/* Directions button */}
          <button className="modal-directions-btn" onClick={handleDirections}>
            <FaMapMarkerAlt /> Get Directions
          </button>

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <p className="modal-section-label">REVIEWS</p>
              <div className="modal-reviews-list">
                {reviews.slice(0, 5).map((review, i) => (
                  <div key={i} className="modal-review-card">
                    <div className="modal-review-header">
                      <img
                        src={review.authorAttribution?.photoUri ?? 'https://placehold.co/36?text=?'}
                        alt={review.authorAttribution?.displayName}
                        className="modal-review-avatar"
                        onError={e => { e.currentTarget.src = 'https://placehold.co/36?text=?'; }}
                      />
                      <div>
                        <p className="modal-review-author">
                          {review.authorAttribution?.displayName ?? 'Anonymous'}
                        </p>
                        <div className="modal-stars">{renderStars(review.rating)}</div>
                      </div>
                      {review.relativePublishTimeDescription && (
                        <span className="modal-review-time">
                          {review.relativePublishTimeDescription}
                        </span>
                      )}
                    </div>
                    <p className="modal-review-text">{review.text?.text ?? ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */
export default function SuggestedPlaces({ places = [] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true);
  const [placesData, setPlacesData] = useState([]);
  const [error, setError] = useState(null);
  const [selectedPlace, setSelectedPlace] = useState(null);

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

      if (!response.ok) throw new Error(`Server error ${response.status}`);

      const data = await response.json();
      setPlacesData(data.places ?? []);
    } catch (err) {
      console.error('Places error:', err);
      setError(err.message || 'Could not load nearby places');
    } finally {
      setLoading(false);
    }
  };

  const getGooglePhoto = (photos) => {
    if (!photos || photos.length === 0) return 'https://placehold.co/400?text=No+Image';
    const photoName = photos[0].name;
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=400&key=${process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY}`;
  };

  const handleDirections = (e, place) => {
    e.stopPropagation() // prevent opening the modal
    const lat = place.location?.latitude
    const lng = place.location?.longitude
    const label = place.displayName?.text ?? ''

    if (lat && lng) {
      router.push(`/map?lat=${lat}&lng=${lng}&label=${encodeURIComponent(label)}`)
    } else {
      router.push(`/map?label=${encodeURIComponent(label)}`)
    }
  }

  useEffect(() => {
    searchNearbyPlaces();
  }, []);

  return (
    <>
      <div className={styles.container}>
        <p className={styles.main_title}>SUGGESTED PLACES</p>
        <div className={styles.places_container}>
          {loading ? (
            <div className="spinner-container">
              <div className="loading-spinner"></div>
              <p>Fetching Suggestions...</p>
            </div>
          ) : error ? (
            <div className={styles.error_state}>
              <span className={styles.error_icon}>🗺️</span>
              <p className={styles.error_title}>Nearby places unavailable</p>
              <p className={styles.error_subtitle}>
                Place suggestions require a Google Places API key.
              </p>
              <button className={styles.retry_btn} onClick={searchNearbyPlaces}>
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
                No places found...
              </p>
            </div>
          ) : (
            placesData.map((place) => (
              <div
                key={place.id}
                className={`${styles.card} place-card`}
                onClick={() => setSelectedPlace(place)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedPlace(place)}
                aria-label={`View details for ${place.displayName?.text}`}
              >
                <div style={{ overflow: 'hidden' }}>
                  <img
                    src={getGooglePhoto(place.photos)}
                    alt={place.displayName?.text}
                    className={`${styles.image} card-image`}
                    onError={e => { e.currentTarget.src = 'https://placehold.co/400?text=No+Image'; }}
                  />
                </div>
                <div className={styles.info}>
                  <h4 className={styles.title}>{place.displayName?.text}</h4>
                  <p className={styles.description}>{place.formattedAddress}</p>
                  <div className={styles.cardBottom}>
                    <div className={styles.rating}>
                      <FaStar className={styles.star} /> {place.rating ?? 'N/A'} ({place.userRatingCount ?? 0})
                    </div>
                    <button
                      className={styles.directionsBtn}
                      onClick={(e) => handleDirections(e, place)}
                      title="Get directions"
                    >
                      <FaMapMarkerAlt /> Directions
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedPlace && (
        <PlaceModal
          place={selectedPlace}
          onClose={() => setSelectedPlace(null)}
        />
      )}
    </>
  );
}