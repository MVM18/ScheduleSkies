import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Sidebar from '@/components/Sidebar'

const MapScreen = dynamic(() => import('../components/Map_Screen/Map'), {
  ssr: false
});

export default function MapPage() {
  const router = useRouter();
  const { lat, lng, label } = router.query;

  return (
    <main className="dashboard">
      <Sidebar />
      <div className="dashboard-content" style={{ padding: '1rem', height: '100vh' }}>
        <div style={{ height: 'calc(100vh - 2rem)', width: '100%' }}>
          <MapScreen 
            venueCoords={lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng), label: label || 'Event Venue' } : null} 
          />
        </div>
      </div>
    </main>
  )
}