import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GEOAPIFY_API_KEY = '6e3efd748a384a27baf68a0621732be5';
const mapStyle = 'osm-bright';

const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="
    width:18px;height:18px;border-radius:50% 50% 50% 0;
    background:${color};border:2px solid white;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const originIcon = createIcon('#2C5282');
const destIcon   = createIcon('#E53E3E');
const placeIcon  = createIcon('#E53E3E');

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 15, { duration: 1.2 });
  }, [coords, map]);
  return null;
}

function SearchInput({ placeholder, value, onChange, onSelect, icon }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(async (text) => {
    if (text.length < 3) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res  = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=${GEOAPIFY_API_KEY}&limit=5`);
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch { setSuggestions([]); }
    setLoading(false);
  }, []);

  const handleChange = (e) => {
    onChange(e.target.value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 350);
  };

  const handleSelect = (feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    onSelect({ lat, lng, label: feature.properties.formatted });
    onChange(feature.properties.formatted);
    setSuggestions([]);
  };

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '12px', padding: '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', gap: '8px' }}>
        <span style={{ fontSize: '15px' }}>{icon}</span>
        <input
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          style={{ border: 'none', outline: 'none', fontSize: '13px', flex: 1, color: '#1A365D', background: 'transparent' }}
        />
        {loading && <span style={{ fontSize: '11px', color: '#aaa' }}>⏳</span>}
      </div>
      {suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'white', borderRadius: '12px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {suggestions.map((s, i) => (
            <div key={i} onClick={() => handleSelect(s)}
              style={{ padding: '10px 14px', fontSize: '12px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none', color: '#333' }}
              onMouseEnter={e => e.currentTarget.style.background = '#EBF4FF'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >📍 {s.properties.formatted}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nearby places with real coordinates in Cebu ──────────────────────────────
const NEARBY_PLACES = [
  { name: 'Fort San Pedro',          rating: '4.2', reviews: '7,739',  lat: 10.2933, lng: 123.9020, emoji: '🏰' },
  { name: "Magellan's Cross",        rating: '4.5', reviews: '12,301', lat: 10.2952, lng: 123.9017, emoji: '✝️'  },
  { name: 'Basilica del Sto. Niño',  rating: '4.7', reviews: '9,812',  lat: 10.2950, lng: 123.9010, emoji: '⛪' },
  { name: 'Cebu Taoist Temple',      rating: '4.3', reviews: '5,421',  lat: 10.3310, lng: 123.8988, emoji: '🏯' },
  { name: 'Tops Lookout',            rating: '4.6', reviews: '3,204',  lat: 10.3448, lng: 123.8886, emoji: '🌄' },
  { name: 'Cebu Ocean Park',         rating: '4.1', reviews: '4,102',  lat: 10.2876, lng: 123.8972, emoji: '🐠' },
];

const MapScreen = () => {
  const [originText, setOriginText] = useState('');
  const [destText,   setDestText]   = useState('');
  const [origin,      setOrigin]      = useState(null);
  const [destination, setDestination] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeInfo,   setRouteInfo]   = useState(null);
  const [routeMode,   setRouteMode]   = useState('drive');
  const [flyTo,       setFlyTo]       = useState(null);
  const [isRouting,   setIsRouting]   = useState(false);
  const [routeError,  setRouteError]  = useState('');

  // Sidebar place state
  const [selectedPlace,     setSelectedPlace]     = useState(null); // { lat, lng, name }
  const [placeRouteCoords,  setPlaceRouteCoords]  = useState(null);
  const [placeRouteInfo,    setPlaceRouteInfo]     = useState(null); // { distance, time }
  const [placeLoading,      setPlaceLoading]       = useState(false);

  const defaultPosition = [10.3204, 123.9242];

  // ── Main routing ────────────────────────────────────────────────────────────
  const handleOriginSelect = (place) => {
    setOrigin(place);
    setFlyTo([place.lat, place.lng]);
    setRouteCoords(null); setRouteInfo(null); setRouteError('');
    // clear place selection when origin changes
    setSelectedPlace(null); setPlaceRouteCoords(null); setPlaceRouteInfo(null);
  };

  const handleDestSelect = (place) => {
    setDestination(place);
    setFlyTo([place.lat, place.lng]);
    setRouteCoords(null); setRouteInfo(null); setRouteError('');
    setSelectedPlace(null); setPlaceRouteCoords(null); setPlaceRouteInfo(null);
  };

  const fetchRoute = async (org, dst, mode) => {
    if (!org || !dst) { setRouteError('Please set both origin and destination.'); return; }
    setIsRouting(true); setRouteError(''); setRouteCoords(null); setRouteInfo(null);
    try {
      const url  = `https://api.geoapify.com/v1/routing?waypoints=${org.lat},${org.lng}|${dst.lat},${dst.lng}&mode=${mode}&apiKey=${GEOAPIFY_API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.features?.length) { setRouteError('No route found.'); setIsRouting(false); return; }
      const feature = data.features[0];
      let coords = [];
      if (feature.geometry.type === 'MultiLineString') feature.geometry.coordinates.forEach(l => l.forEach(([lng, lat]) => coords.push([lat, lng])));
      else if (feature.geometry.type === 'LineString') feature.geometry.coordinates.forEach(([lng, lat]) => coords.push([lat, lng]));
      setRouteCoords(coords);
      setRouteInfo({ distance: (feature.properties.distance / 1000).toFixed(1), time: Math.round(feature.properties.time / 60) });
      if (coords.length) setFlyTo(coords[Math.floor(coords.length / 2)]);
    } catch { setRouteError('Failed to fetch route.'); }
    setIsRouting(false);
  };

  // ── Nearby place click ───────────────────────────────────────────────────────
  const handlePlaceClick = async (place) => {
    // If same place clicked again, deselect
    if (selectedPlace?.name === place.name) {
      setSelectedPlace(null); setPlaceRouteCoords(null); setPlaceRouteInfo(null); return;
    }
    setSelectedPlace(place);
    setFlyTo([place.lat, place.lng]);
    setPlaceRouteCoords(null); setPlaceRouteInfo(null);

    // Need an origin to draw a route to the place
    const org = origin || { lat: defaultPosition[0], lng: defaultPosition[1], label: 'Cebu City Center' };
    setPlaceLoading(true);
    try {
      const url  = `https://api.geoapify.com/v1/routing?waypoints=${org.lat},${org.lng}|${place.lat},${place.lng}&mode=${routeMode}&apiKey=${GEOAPIFY_API_KEY}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.features?.length) {
        const feature = data.features[0];
        let coords = [];
        if (feature.geometry.type === 'MultiLineString') feature.geometry.coordinates.forEach(l => l.forEach(([lng, lat]) => coords.push([lat, lng])));
        else if (feature.geometry.type === 'LineString') feature.geometry.coordinates.forEach(([lng, lat]) => coords.push([lat, lng]));
        setPlaceRouteCoords(coords);
        setPlaceRouteInfo({ distance: (feature.properties.distance / 1000).toFixed(1), time: Math.round(feature.properties.time / 60) });
      }
    } catch {}
    setPlaceLoading(false);
  };

  const clearAll = () => {
    setOrigin(null); setDestination(null);
    setOriginText(''); setDestText('');
    setRouteCoords(null); setRouteInfo(null); setRouteError('');
    setSelectedPlace(null); setPlaceRouteCoords(null); setPlaceRouteInfo(null);
    setFlyTo(defaultPosition);
  };

  const modeOptions = [
    { key: 'drive',   icon: '🚗', label: 'Drive'   },
    { key: 'walk',    icon: '🚶', label: 'Walk'    },
    { key: 'transit', icon: '🚌', label: 'Transit' },
  ];

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* ── Left Sidebar ── */}
      <div style={{ width: '70px', backgroundColor: '#1A365D', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', zIndex: 10 }}>
        <div style={{ marginBottom: '32px' }}><span style={{ fontSize: '28px' }}>☁️</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', flex: 1 }}>
          {['🏠','📅'].map((icon, i) => (
            <button key={i} style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', opacity: 0.6, cursor: 'pointer' }}>{icon}</button>
          ))}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '3px', height: '28px', backgroundColor: '#FFD700', borderRadius: '2px', position: 'absolute', left: '-12px' }}></div>
            <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', cursor: 'pointer' }}>🗺️</button>
          </div>
          <button style={{ background: 'none', border: 'none', color: 'white', fontSize: '22px', opacity: 0.6, cursor: 'pointer' }}>👤</button>
        </div>
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '10px', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: '8px 14px', borderRadius: '25px', gap: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
            <span>☀️</span>
            <span style={{ fontWeight: '600', color: '#333', fontSize: '13px' }}>37°C · Sunny</span>
          </div>

          {/* Routing Panel */}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.97)', borderRadius: '18px', padding: '12px 14px', boxShadow: '0 4px 18px rgba(0,0,0,0.13)', minWidth: '280px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <SearchInput placeholder="From — origin location" value={originText} onChange={setOriginText} onSelect={handleOriginSelect} icon="🟦" />
              <SearchInput placeholder="To — destination"        value={destText}   onChange={setDestText}   onSelect={handleDestSelect}   icon="🔴" />

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                {modeOptions.map(({ key, icon, label }) => (
                  <button key={key} onClick={() => setRouteMode(key)} title={label}
                    style={{ padding: '6px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', background: routeMode === key ? '#2C5282' : '#EDF2F7', transform: routeMode === key ? 'scale(1.12)' : 'scale(1)' }}
                  >{icon}</button>
                ))}
                <button onClick={() => fetchRoute(origin, destination, routeMode)} disabled={isRouting}
                  style={{ marginLeft: 'auto', padding: '7px 20px', borderRadius: '10px', border: 'none', background: '#2C5282', color: 'white', fontWeight: '700', fontSize: '13px', cursor: isRouting ? 'not-allowed' : 'pointer', opacity: isRouting ? 0.6 : 1 }}
                >{isRouting ? 'Routing…' : 'Go →'}</button>
                {(origin || destination || routeCoords) && (
                  <button onClick={clearAll} style={{ padding: '7px 10px', borderRadius: '10px', border: 'none', background: '#FED7D7', color: '#C53030', fontSize: '12px', cursor: 'pointer', fontWeight: '700' }}>✕</button>
                )}
              </div>

              {routeError && <div style={{ fontSize: '12px', color: '#E53E3E', padding: '5px 10px', background: '#FFF5F5', borderRadius: '8px' }}>⚠️ {routeError}</div>}
              {routeInfo  && (
                <div style={{ display: 'flex', gap: '12px', padding: '7px 12px', background: '#EBF8FF', borderRadius: '10px', fontSize: '12px', fontWeight: '700', color: '#2C5282' }}>
                  <span>📏 {routeInfo.distance} km</span>
                  <span>⏱ {routeInfo.time} min</span>
                  <span style={{ textTransform: 'capitalize', marginLeft: 'auto' }}>{modeOptions.find(m => m.key === routeMode)?.icon} {routeMode}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ flex: 1, borderRadius: '24px', border: '6px solid #2C5282', overflow: 'hidden', position: 'relative' }}>
          <MapContainer center={defaultPosition} zoom={14} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <TileLayer
              url={`https://maps.geoapify.com/v1/tile/${mapStyle}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`}
              attribution='Powered by <a href="https://www.geoapify.com/">Geoapify</a> | &copy; OpenStreetMap contributors'
            />
            {flyTo && <FlyTo coords={flyTo} />}

            {/* Origin marker */}
            {origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon}><Popup><strong>Origin</strong><br />{origin.label}</Popup></Marker>}

            {/* Destination marker */}
            {destination && <Marker position={[destination.lat, destination.lng]} icon={destIcon}><Popup><strong>Destination</strong><br />{destination.label}</Popup></Marker>}

            {/* Main route polyline */}
            {routeCoords && <Polyline positions={routeCoords} pathOptions={{ color: '#2C5282', weight: 5, opacity: 0.85 }} />}

            {/* Selected nearby place: red marker + dashed route from origin */}
            {selectedPlace && (
              <Marker position={[selectedPlace.lat, selectedPlace.lng]} icon={placeIcon}>
                <Popup>
                  <strong>{selectedPlace.name}</strong>
                  {placeRouteInfo && <><br />📏 {placeRouteInfo.distance} km &nbsp; ⏱ {placeRouteInfo.time} min</>}
                </Popup>
              </Marker>
            )}
            {placeRouteCoords && (
              <Polyline positions={placeRouteCoords} pathOptions={{ color: '#E53E3E', weight: 4, opacity: 0.75, dashArray: '8 6' }} />
            )}
          </MapContainer>

          {/* Map overlay buttons */}
          <div style={{ position: 'absolute', right: '14px', top: '14px', display: 'flex', flexDirection: 'column', gap: '8px', zIndex: 1000 }}>
            {['📊','🚦','📍'].map((icon, i) => (
              <button key={i} style={{ backgroundColor: 'white', width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontSize: '16px' }}>{icon}</button>
            ))}
            <div style={{ background: 'white', borderRadius: '19px', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
              <button style={{ width: '38px', height: '38px', border: 'none', background: 'none', fontSize: '22px', color: '#555', cursor: 'pointer' }}>+</button>
              <div style={{ height: '1px', background: '#eee', margin: '0 8px' }}></div>
              <button style={{ width: '38px', height: '38px', border: 'none', background: 'none', fontSize: '22px', color: '#555', cursor: 'pointer' }}>−</button>
            </div>
            <button style={{ backgroundColor: 'white', width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', fontSize: '16px' }}>🧭</button>
          </div>
        </div>
      </div>

      {/* ── Right Sidebar ── */}
      <div style={{ width: '250px', backgroundColor: '#81D4FA', padding: '14px', display: 'flex', flexDirection: 'column', overflowY: 'auto', gap: '8px' }}>

        {/* ── Section 1: Where do you want to go? ── */}
        <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1A365D', margin: '0 0 4px', textAlign: 'center', letterSpacing: '0.3px' }}>
          📍 Where do you want to go?
        </h3>
        <p style={{ fontSize: '10px', color: '#2C5282', textAlign: 'center', margin: '0 0 6px', opacity: 0.8 }}>
          Click a place to see travel time
        </p>

        {NEARBY_PLACES.map((place, i) => {
          const isSelected = selectedPlace?.name === place.name;
          return (
            <div key={i}
              onClick={() => handlePlaceClick(place)}
              style={{
                backgroundColor: isSelected ? '#2C5282' : 'white',
                borderRadius: '14px', padding: '8px 10px',
                display: 'flex', alignItems: 'center', gap: '8px',
                cursor: 'pointer', transition: 'all 0.18s',
                boxShadow: isSelected ? '0 4px 12px rgba(44,82,130,0.35)' : '0 1px 4px rgba(0,0,0,0.08)',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                border: isSelected ? '2px solid #FFD700' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (!isSelected) e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { if (!isSelected) e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{ width: '40px', height: '34px', borderRadius: '8px', background: isSelected ? 'rgba(255,255,255,0.15)' : '#EDF2F7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                {place.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: isSelected ? 'white' : '#1A365D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {place.name.toUpperCase()}
                </div>
                <div style={{ fontSize: '9px', color: isSelected ? '#BEE3F8' : '#666' }}>
                  {place.rating} ★ ({place.reviews})
                </div>
                {/* Travel time badge when selected */}
                {isSelected && (
                  <div style={{ marginTop: '4px', fontSize: '10px', fontWeight: '700', color: '#FFD700' }}>
                    {placeLoading ? '⏳ Calculating…' : placeRouteInfo ? `⏱ ${placeRouteInfo.time} min · 📏 ${placeRouteInfo.distance} km` : '📍 Locating…'}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* ── Section 2: Active Routes ── */}
        <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1A365D', margin: '12px 0 4px', textAlign: 'center', letterSpacing: '0.3px' }}>
          🛣️ Active Routes
        </h3>

        {[
          { bg: '#E8F5E9', traffic: 'Light traffic',  time: '12 mins',      color: '#2E7D32', via: 'via Osmeña Blvd' },
          { bg: '#FFEBEE', traffic: 'Heavy traffic',   time: '1 hr 37 mins', color: '#C62828', via: 'via Cebu Capitol' },
          { bg: '#FFFDE7', traffic: 'Medium traffic',  time: '32 mins',      color: '#F57F17', via: 'via N. Escario St' },
        ].map((route, i) => (
          <div key={i} style={{ backgroundColor: route.bg, borderRadius: '14px', padding: '10px', border: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textAlign: 'center', color: '#1A365D' }}>Hotel → Anzanih</div>
            <div style={{ fontSize: '10px', color: '#666', textAlign: 'center' }}>{route.via}</div>
            <div style={{ fontSize: '9px', textAlign: 'center', marginTop: '3px', color: route.color, fontWeight: '600' }}>{route.traffic}</div>
            <div style={{ fontSize: '13px', fontWeight: '800', textAlign: 'center', color: '#1A365D' }}>{route.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapScreen;