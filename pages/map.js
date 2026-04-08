import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar'

const MapScreen = dynamic(() => import('../components/Map_Screen/Map'), {
  ssr: false
});

export default function MapPage() {
  return (
    <main className="dashboard">
      <Sidebar />
      <div className="dashboard-content" style={{ padding: '1rem', height: '100vh' }}>
        <div style={{ height: 'calc(100vh - 2rem)', width: '100%' }}>
          <MapScreen />
        </div>
      </div>
    </main>
  )
}