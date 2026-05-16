import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { buildItineraryWaypoints, buildVenueCoords } from '@/lib/buildItineraryWaypoints';
import styles from '../styles/share.module.css';

const MapScreen = dynamic(() => import('./Map_Screen/Map'), { ssr: false });

/**
 * Embedded map for shared event pages (works without login).
 * mapFocus: null | { type: 'venue' } | { type: 'itinerary' } | { type: 'activity', activityId }
 */
export default function SharedEventMapSection({
  event,
  activities = [],
  mapFocus = null,
  pickMode = false,
  pickInitialCoords = null,
  pickHintLabel = '',
  onPickConfirm,
  onPickCancel,
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapContainerRef = useRef(null);

  const triggerMapResize = useCallback(() => {
    window.dispatchEvent(new Event('resize'));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    const timer = setTimeout(triggerMapResize, 150);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
  }, [isFullscreen, triggerMapResize]);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const waypoints = useMemo(
    () => buildItineraryWaypoints(event, activities),
    [event, activities]
  );
  const venueCoords = useMemo(() => buildVenueCoords(event), [event]);

  const focusWaypointIndex = useMemo(() => {
    if (!mapFocus) return null;
    if (mapFocus.type === 'venue') return 0;
    if (mapFocus.type === 'itinerary') return 0;
    if (mapFocus.type === 'activity' && mapFocus.activityId) {
      const idx = waypoints.findIndex((w) => w.activityId === mapFocus.activityId);
      return idx >= 0 ? idx : null;
    }
    return null;
  }, [mapFocus, waypoints]);

  const displayVenueCoords = useMemo(() => {
    if (mapFocus?.type === 'itinerary') return null;
    if (mapFocus?.type === 'activity' && mapFocus.activityId) {
      const wp = waypoints.find((w) => w.activityId === mapFocus.activityId);
      if (wp?.lat && wp?.lng) {
        return { lat: wp.lat, lng: wp.lng, label: wp.label || wp.activityName || 'Activity' };
      }
    }
    return venueCoords;
  }, [mapFocus, waypoints, venueCoords]);

  const displayWaypoints = mapFocus?.type === 'venue' ? [] : waypoints;
  const searchLabel =
    mapFocus?.type === 'activity'
      ? waypoints.find((w) => w.activityId === mapFocus.activityId)?.label
      : null;

  if (!event && !pickMode) return null;

  const hasMapData =
    pickMode ||
    displayVenueCoords ||
    displayWaypoints.length > 0 ||
    event?.location;

  if (!hasMapData) return null;

  return (
    <section className={styles.sharedMapSection} id="shared-event-map">
      <div className={styles.sharedMapSectionHeader}>
        <h3 className={styles.sharedMapTitle}>Map &amp; Navigation</h3>
        <p className={styles.sharedMapSubtitle}>
          View the venue and activity locations. Plan routes without signing in.
        </p>
      </div>
      <div
        ref={mapContainerRef}
        className={`${styles.sharedMapContainer} ${isFullscreen ? styles.sharedMapContainerFullscreen : ''}`}
      >
        <button
          type="button"
          className={styles.sharedMapFullscreenBtn}
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit full screen map' : 'Expand map to full screen'}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? (
            <>
              <span className={styles.sharedMapFullscreenIcon} aria-hidden>✕</span>
              Exit full screen
            </>
          ) : (
            <>
              <span className={styles.sharedMapFullscreenIcon} aria-hidden>⛶</span>
              Full screen
            </>
          )}
        </button>
        <MapScreen
          embedded
          venueCoords={displayVenueCoords}
          itineraryWaypoints={displayWaypoints.length > 0 ? displayWaypoints : null}
          searchLabel={searchLabel}
          focusWaypointIndex={focusWaypointIndex}
          pickMode={pickMode}
          pickContext="shared-activity"
          pickInitialCoords={pickInitialCoords}
          pickHintLabel={pickHintLabel}
          onPickConfirm={onPickConfirm}
          onPickCancel={onPickCancel}
        />
      </div>
    </section>
  );
}
