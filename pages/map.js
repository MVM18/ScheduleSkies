import dynamic from 'next/dynamic';

const MapScreen = dynamic(() => import('../components/Map_Screen/Map'), {
  ssr: false
});

export default function MapPage() {
  return <MapScreen />;
}