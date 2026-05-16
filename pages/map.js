import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar'

const MapScreen = dynamic(() => import('../components/Map_Screen/Map'), {
  ssr: false
});

export default function MapPage() {
  const router = useRouter();

  // Wait for router.query to be populated before reading params.
  // Without this, pickMode would initially be false (query is {}) and
  // MapScreen would render in normal mode, then re-render with pick mode
  // once the query becomes available — causing pick mode to break.
  if (!router.isReady) {
    return (
      <main className="dashboard" style={{ padding: 0, minHeight: '100vh' }}>
        <Sidebar />
        <div style={{
          position: 'fixed', top: 0, left: 80, right: 0, bottom: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f0f4f8', fontFamily: "'Segoe UI', sans-serif",
        }}>
          <span style={{ fontSize: '18px', color: '#4A5568' }}>⏳ Loading map…</span>
        </div>
      </main>
    );
  }

  const { lat, lng, label, waypoints, pick, from, returnTo } = router.query;

  const isPickMode = pick === '1' || pick === 'true';

  const rawFrom = typeof from === 'string' ? from : 'event';
  const allowedPickContexts = ['event', 'activity', 'shared-activity'];
  const pickContext = allowedPickContexts.includes(rawFrom) ? rawFrom : 'event';

  // Parse single venue coords (skipped in pick mode so the map starts clean for pinning)
  const venueCoords = !isPickMode && lat && lng
    ? { lat: parseFloat(lat), lng: parseFloat(lng), label: label || 'Event Venue' }
    : null;

  // Parse multi-waypoint array
  let parsedWaypoints = null;
  if (waypoints) {
    try {
      parsedWaypoints = JSON.parse(waypoints);
    } catch (e) {
      console.error('Failed to parse waypoints:', e);
    }
  }

  return (
    <main className="dashboard" style={{ padding: 0, minHeight: '100vh' }}>
      <Sidebar />
      <MapScreen
        venueCoords={venueCoords}
        itineraryWaypoints={parsedWaypoints}
        searchLabel={!isPickMode && !venueCoords && label ? label : null}
        pickMode={isPickMode}
        pickContext={pickContext}
        pickInitialCoords={
          isPickMode && lat && lng && !Number.isNaN(parseFloat(lat)) && !Number.isNaN(parseFloat(lng))
            ? { lat: parseFloat(lat), lng: parseFloat(lng) }
            : null
        }
        pickHintLabel={typeof label === 'string' ? label : ''}
        returnPath={typeof returnTo === 'string' && returnTo.startsWith('/') ? returnTo : '/plan'}
      />
    </main>
  )
}