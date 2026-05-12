import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar'

const MapScreen = dynamic(() => import('../components/Map_Screen/Map'), {
  ssr: false
});

export default function MapPage() {
  const router = useRouter();
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