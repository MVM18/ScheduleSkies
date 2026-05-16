import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { motion, AnimatePresence } from 'framer-motion';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY;
const WEATHER_API_KEY = process.env.NEXT_PUBLIC_WEATHER_API_KEY;
const mapStyle = 'osm-bright';

const isActivityPickContext = (ctx) => ctx === 'activity' || ctx === 'shared-activity';

const createPinIcon = (fillColor, borderColor = 'white', size = 28) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.3}" viewBox="0 0 28 36">
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="${fillColor}" stroke="${borderColor}" stroke-width="2"/>
    <circle cx="14" cy="14" r="5" fill="white" opacity="0.9"/>
  </svg>`,
  iconSize: [size, size * 1.3],
  iconAnchor: [size / 2, size * 1.3],
  popupAnchor: [0, -(size * 1.3)],
});

const createPinIconHighlighted = (fillColor, size = 36) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.3}" viewBox="0 0 28 36">
    <filter id="glow">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${fillColor}" flood-opacity="0.5"/>
    </filter>
    <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
      fill="${fillColor}" stroke="#FFD700" stroke-width="2.5" filter="url(#glow)"/>
    <circle cx="14" cy="14" r="5" fill="white" opacity="0.95"/>
  </svg>`,
  iconSize: [size, size * 1.3],
  iconAnchor: [size / 2, size * 1.3],
  popupAnchor: [0, -(size * 1.3)],
});

const createDotIcon = (fillColor, size = 16) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="6" fill="${fillColor}" stroke="white" stroke-width="2.5"/>
    <circle cx="8" cy="8" r="2.5" fill="white" opacity="0.85"/>
  </svg>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
  popupAnchor: [0, -(size / 2)],
});

const createDotIconHighlighted = (fillColor, size = 22) => L.divIcon({
  className: '',
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="9" fill="${fillColor}" stroke="#FFD700" stroke-width="3"/>
    <circle cx="11" cy="11" r="3.5" fill="white" opacity="0.9"/>
  </svg>`,
  iconSize: [size, size],
  iconAnchor: [size / 2, size / 2],
  popupAnchor: [0, -(size / 2)],
});

const createPlacePin = (type, isHighlighted = false) => {
  const color = getPlaceColor(type);
  const size = isHighlighted ? 34 : 26;
  const stroke = isHighlighted ? '#FFD700' : 'white';
  const sw = isHighlighted ? '2.5' : '2';
  // Use a small letter/shape inside based on type
  const innerShape = {
    restaurant: `<rect x="9" y="8" width="10" height="9" rx="1.5" fill="white" opacity="0.85"/>
                 <line x1="14" y1="7" x2="14" y2="17" stroke="${color}" stroke-width="1.2"/>
                 <line x1="10" y1="11" x2="18" y2="11" stroke="${color}" stroke-width="1.2"/>`,
    parking:    `<text font-size="9" font-weight="700" font-family="sans-serif" fill="white" 
                  text-anchor="middle" x="14" y="17" opacity="0.95">P</text>`,
    attraction: `<polygon points="14,7 16,12 21,12 17,15 18.5,20 14,17 9.5,20 11,15 7,12 12,12" 
                  fill="white" opacity="0.85"/>`,
    park:       `<ellipse cx="14" cy="11" rx="5" ry="4" fill="white" opacity="0.85"/>
                 <rect x="12.5" y="13" width="3" height="5" fill="white" opacity="0.85"/>`,
    shopping:   `<rect x="9" y="10" width="10" height="8" rx="1" fill="none" stroke="white" stroke-width="1.3" opacity="0.9"/>
                 <path d="M11 10 Q11 7 14 7 Q17 7 17 10" fill="none" stroke="white" stroke-width="1.3" opacity="0.9"/>`,
    hotel:      `<text font-size="9" font-weight="700" font-family="sans-serif" fill="white" 
                  text-anchor="middle" x="14" y="17" opacity="0.95">H</text>`,
    other:      `<circle cx="14" cy="13" r="4" fill="white" opacity="0.8"/>`,
  }[type] || `<circle cx="14" cy="13" r="4" fill="white" opacity="0.8"/>`;

  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.3}" viewBox="0 0 28 36">
      <path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z"
        fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      ${innerShape}
    </svg>`,
    iconSize: [size, size * 1.3],
    iconAnchor: [size / 2, size * 1.3],
    popupAnchor: [0, -(size * 1.3)],
  });
};

const originIcon            = createPinIcon('#2C5282');
const originIconHighlight   = createPinIconHighlighted('#2C5282');
const destIcon              = createPinIcon('#E53E3E');
const destIconHighlight     = createPinIconHighlighted('#E53E3E');
const userLocationIcon      = createDotIcon('#2C5282');
const userLocationIconHighlight = createDotIconHighlighted('#2C5282');
const getPlaceIcon = (type, size = 14, color = 'currentColor') => {
  const icons = {
    restaurant: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2l0 7a4 4 0 0 0 8 0l0 -7"/><path d="M7 2l0 7"/><path d="M21 15a2 2 0 0 1 -2 2h-7l-5 3v-14h12a2 2 0 0 1 2 2z"/></svg>,
    parking:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 7h-3v10"/><path d="M13 13a3 3 0 0 0 0 -6h-3"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
    attraction: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l18 0"/><path d="M6 21v-14a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2v14"/><path d="M9 21v-6a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6"/></svg>,
    park:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l4 4l-2 0l0 3l3 0l0 -2l4 4l-4 4l0 -2l-3 0l0 3l2 0l-4 4l-4 -4l2 0l0 -3l-3 0l0 2l-4 -4l4 -4l0 2l3 0l0 -3l-2 0z"/></svg>,
    shopping:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2l1.5 3h9l1.5 -3"/><path d="M3 6h18l-2 13h-14z"/><path d="M9 12a3 3 0 0 0 6 0"/></svg>,
    hotel:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a4 4 0 0 1 4 -4h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4z"/><path d="M7 10a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M13 10h4v4h-4z"/></svg>,
    other:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/></svg>,
  };
  return icons[type] || icons.other;
};

const getPlaceColor = (type) => {
  switch (type) {
    case 'restaurant': return '#FF5722';
    case 'parking': return '#2196F3';
    case 'attraction': return '#9C27B0';
    case 'park': return '#4CAF50';
    case 'shopping': return '#FF9800';
    case 'hotel': return '#673AB7';
    default: return '#9E9E9E';
  }
};

const createPlaceIcon = (type, isHighlighted = false) => {
  const emoji = getPlaceIcon(type);
  const size = isHighlighted ? 36 : 28;
  const fontSize = isHighlighted ? 18 : 14;
  const borderWidth = isHighlighted ? '3px' : '2px';
  const borderColor = isHighlighted ? '#FFD700' : 'white';
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:${getPlaceColor(type)};border:${borderWidth} solid ${borderColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;box-shadow:0 2px 8px rgba(0,0,0,0.4);cursor:pointer;transition:all 0.2s;">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

function FlyTo({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.flyTo(coords, 15, { duration: 1.2 });
  }, [coords, map]);
  return null;
}

function MapResizeHelper() {
  const map = useMap();
  useEffect(() => {
    const fix = () => {
      map.invalidateSize({ animate: false });
    };
    fix();
    const t = window.setTimeout(fix, 150);
    window.addEventListener('resize', fix);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', fix);
    };
  }, [map]);
  return null;
}

function MapPickClickHandler({ enabled, onLatLngClick }) {
  useMapEvents({
    click(e) {
      if (enabled) onLatLngClick(e.latlng);
    },
  });
  return null;
}

function MapClickHandler({ mode, onSetOrigin, onSetDestination, isLocked }) {
  useMapEvents({
    click: async (e) => {
      if (isLocked) return;
      if (mode === 'origin') {
        onSetOrigin(e.latlng);
      } else if (mode === 'destination') {
        onSetDestination(e.latlng);
      }
    },
  });
  return null;
}

async function reverseGeocodeLatLng(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { Accept: 'application/json' } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  } catch {
    return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  }
}

function WeatherWidget({ location, isMobile }) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchWeather = useCallback(async (lat, lon) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${WEATHER_API_KEY}`
      );
      const data = await response.json();
      if (data.cod === 200) {
        setWeather({
          temp: Math.round(data.main.temp),
          feelsLike: Math.round(data.main.feels_like),
          condition: data.weather[0].main,
          description: data.weather[0].description,
          icon: data.weather[0].icon,
          humidity: data.main.humidity,
          windSpeed: Math.round(data.wind.speed * 3.6),
          location: data.name,
        });
      } else {
        setError('Unable to fetch weather data');
      }
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Weather service unavailable');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (location) fetchWeather(location.lat, location.lng);
  }, [location, fetchWeather]);

  const getWeatherIcon = (condition) => {
    const icons = {
      Clear: '☀️',
      Clouds: '☁️',
      Rain: '🌧️',
      Drizzle: '🌦️',
      Thunderstorm: '⛈️',
      Snow: '🌨️',
      Mist: '🌫️',
      Fog: '🌫️',
      Haze: '🌫️',
    };
    return icons[condition] || '🌤️';
  };

  const getWeatherBackground = (condition) => {
    const backgrounds = {
      Clear: 'linear-gradient(135deg, #FFD700, #FFA500)',
      Clouds: 'linear-gradient(135deg, #B0BEC5, #78909C)',
      Rain: 'linear-gradient(135deg, #4FC3F7, #0288D1)',
      Drizzle: 'linear-gradient(135deg, #81D4FA, #4FC3F7)',
      Thunderstorm: 'linear-gradient(135deg, #5C6BC0, #283593)',
      Snow: 'linear-gradient(135deg, #E1F5FE, #B3E5FC)',
      Mist: 'linear-gradient(135deg, #CFD8DC, #90A4AE)',
    };
    return backgrounds[condition] || 'linear-gradient(135deg, #87CEEB, #4682B4)';
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: isMobile ? '6px 12px' : '8px 14px', borderRadius: '25px', gap: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', whiteSpace: 'nowrap', opacity: 0.7 }}>
        <span>⏳</span>
        <span style={{ fontWeight: '600', color: '#333', fontSize: isMobile ? '11px' : '13px' }}>Loading weather...</span>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', backgroundColor: 'white', padding: isMobile ? '6px 12px' : '8px 14px', borderRadius: '25px', gap: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.1)', whiteSpace: 'nowrap' }}>
        <span>🌤️</span>
        <span style={{ fontWeight: '600', color: '#333', fontSize: isMobile ? '11px' : '13px' }}>--°C · Weather</span>
      </div>
    );
  }

  const widgetContent = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: getWeatherBackground(weather.condition),
        padding: isMobile ? '6px 12px' : '8px 14px',
        borderRadius: '25px',
        gap: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        whiteSpace: 'nowrap',
        color: weather.condition === 'Snow' ? '#333' : 'white',
        cursor: 'pointer',
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      title={`${weather.description} • Humidity: ${weather.humidity}% • Wind: ${weather.windSpeed} km/h`}
    >
      <span style={{ fontSize: isMobile ? '16px' : '20px' }}>{getWeatherIcon(weather.condition)}</span>
      {(!isMobile || isExpanded) && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: '700', fontSize: isMobile ? '12px' : '14px' }}>{weather.temp}°C</span>
            <span style={{ fontSize: isMobile ? '8px' : '10px', opacity: 0.9 }}>Feels {weather.feelsLike}°C</span>
          </div>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.3)', margin: '0 2px' }} />
        </>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: isMobile && !isExpanded ? '10px' : '11px', fontWeight: '600' }}>{weather.condition}</span>
        {(!isMobile || isExpanded) && (
          <span style={{ fontSize: isMobile ? '7px' : '9px', opacity: 0.9 }}>{weather.location || 'Current Location'}</span>
        )}
      </div>
    </div>
  );

  if (isMobile && !isExpanded) {
    return <div onClick={() => setIsExpanded(!isExpanded)}>{widgetContent}</div>;
  }
  return widgetContent;
}

function SearchInput({ placeholder, value, onChange, onSelect, icon, isMobile }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(async (text) => {
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(text)}&apiKey=${GEOAPIFY_API_KEY}&limit=5`
      );
      const data = await res.json();
      setSuggestions(data.features || []);
    } catch {
      setSuggestions([]);
    }
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
      <div style={{ display: 'flex', alignItems: 'center', background: 'white', borderRadius: '12px', padding: isMobile ? '6px 10px' : '8px 12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', gap: '8px' }}>
        <span style={{ fontSize: isMobile ? '13px' : '15px' }}>{icon}</span>
        <input
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          style={{ border: 'none', outline: 'none', fontSize: isMobile ? '11px' : '13px', flex: 1, color: '#1A365D', background: 'transparent' }}
        />
        {loading && <span style={{ fontSize: '11px', color: '#aaa' }}>⏳</span>}
      </div>
      {suggestions.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, background: 'white', borderRadius: '12px', marginTop: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden' }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onClick={() => handleSelect(s)}
              style={{ padding: isMobile ? '8px 12px' : '10px 14px', fontSize: isMobile ? '11px' : '12px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none', color: '#333', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EBF4FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="red" stroke="#718096" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
                <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
              </svg>
              {s.properties.formatted}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const getTrafficColor = (segmentIndex, totalSegments) => {
  const currentHour = new Date().getHours();
  const isWeekend = [0, 6].includes(new Date().getDay());
  const positionFactor = Math.abs(segmentIndex / totalSegments - 0.5) * 2;

  if (!isWeekend) {
    if ((currentHour >= 7 && currentHour <= 9) || (currentHour >= 17 && currentHour <= 19)) {
      if (positionFactor < 0.3) return { color: '#C62828', level: 'heavy', delayFactor: 1.6 };
      if (positionFactor < 0.6) return { color: '#F57F17', level: 'moderate', delayFactor: 1.3 };
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    } else if (currentHour >= 10 && currentHour <= 16) {
      if (positionFactor < 0.4) return { color: '#F57F17', level: 'moderate', delayFactor: 1.2 };
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    } else {
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    }
  } else {
    if (currentHour >= 10 && currentHour <= 18) {
      if (positionFactor < 0.3) return { color: '#F57F17', level: 'moderate', delayFactor: 1.1 };
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    } else {
      return { color: '#4CAF50', level: 'light', delayFactor: 1 };
    }
  }
};

const getRouteSegmentsWithTraffic = (routeCoords) => {
  if (!routeCoords || routeCoords.length < 2) return [];
  const segments = [];
  const totalSegments = routeCoords.length - 1;
  for (let i = 0; i < totalSegments; i++) {
    const traffic = getTrafficColor(i, totalSegments);
    segments.push({
      start: routeCoords[i],
      end: routeCoords[i + 1],
      color: traffic.color,
      level: traffic.level,
      delayFactor: traffic.delayFactor,
    });
  }
  return segments;
};

const getTrafficSummary = (segments) => {
  if (!segments || segments.length === 0) {
    return { level: 'Light', color: '#4CAF50', heavySegments: 0, moderateSegments: 0, lightSegments: 0, avgDelayFactor: 1 };
  }
  let heavyCount = 0, moderateCount = 0, lightCount = 0, totalDelayFactor = 0;
  segments.forEach(segment => {
    if (segment.level === 'heavy') heavyCount++;
    else if (segment.level === 'moderate') moderateCount++;
    else lightCount++;
    totalDelayFactor += segment.delayFactor;
  });
  const avgDelayFactor = totalDelayFactor / segments.length;
  let overallLevel = 'Light', overallColor = '#4CAF50';
  if (heavyCount > segments.length * 0.3) {
    overallLevel = 'Heavy';
    overallColor = '#C62828';
  } else if (moderateCount > segments.length * 0.4) {
    overallLevel = 'Moderate';
    overallColor = '#F57F17';
  }
  return { level: overallLevel, color: overallColor, heavySegments: heavyCount, moderateSegments: moderateCount, lightSegments: lightCount, avgDelayFactor };
};

const getMockPlaces = (routeCoords) => {
  if (!routeCoords || routeCoords.length === 0) return [];
  return [
    { name: 'AYALA Center Cebu', lat: 10.3189, lng: 123.9053, type: 'shopping', distance: 200, rating: 4.5 },
    { name: 'SM City Cebu', lat: 10.3106, lng: 123.8936, type: 'shopping', distance: 350, rating: 4.3 },
    { name: 'Jollibee - Fuente', lat: 10.3100, lng: 123.8950, type: 'restaurant', distance: 150, rating: 4.2 },
    { name: 'McDonald\'s - Osmeña Blvd', lat: 10.3120, lng: 123.8980, type: 'restaurant', distance: 180, rating: 4.1 },
    { name: 'Parking - Ayala Mall', lat: 10.3195, lng: 123.9058, type: 'parking', distance: 100, rating: null },
    { name: 'Parking - SM City', lat: 10.3110, lng: 123.8940, type: 'parking', distance: 120, rating: null },
    { name: 'Magellan\'s Cross', lat: 10.2932, lng: 123.9017, type: 'attraction', distance: 500, rating: 4.7 },
    { name: 'Basilica Minore del Santo Niño', lat: 10.2945, lng: 123.9015, type: 'attraction', distance: 520, rating: 4.8 },
    { name: 'Cebu IT Park', lat: 10.3270, lng: 123.9050, type: 'park', distance: 400, rating: 4.4 },
    { name: 'Waterfront Hotel', lat: 10.3050, lng: 123.8880, type: 'hotel', distance: 300, rating: 4.3 },
    { name: 'Marco Polo Plaza Hotel', lat: 10.3250, lng: 123.8890, type: 'hotel', distance: 450, rating: 4.6 },
    { name: 'Starbucks - Ayala', lat: 10.3192, lng: 123.9055, type: 'restaurant', distance: 220, rating: 4.4 },
    { name: 'Bo\'s Coffee - IT Park', lat: 10.3275, lng: 123.9053, type: 'restaurant', distance: 410, rating: 4.3 },
    { name: 'Ramen Yushoken', lat: 10.3185, lng: 123.9048, type: 'restaurant', distance: 190, rating: 4.6 },
  ];
};

const findPlacesAlongRoute = async (routeCoords) => {
  if (!routeCoords || routeCoords.length === 0) return [];
  const places = [];
  const seenNames = new Set();

  try {
    const sampleSize = Math.min(10, routeCoords.length);
    const step = Math.max(1, Math.floor(routeCoords.length / sampleSize));
    const samplePoints = routeCoords.filter((_, index) => index % step === 0);
    const categories = [
      'catering.restaurant',
      'catering.cafe',
      'parking',
      'tourism.attraction',
      'leisure.park',
      'shopping.mall',
      'accommodation.hotel',
    ];

    for (const point of samplePoints) {
      const url = `https://api.geoapify.com/v2/places?categories=${categories.join(',')}&filter=circle:${point[1]},${point[0]},1000&limit=10&apiKey=${GEOAPIFY_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.features && data.features.length > 0) {
        data.features.forEach(feature => {
          const [lng, lat] = feature.geometry.coordinates;
          const name = feature.properties.name;
          if (!name || seenNames.has(name)) return;
          const category = feature.properties.categories?.[0] || '';
          let placeType = 'other';
          if (category.includes('restaurant') || category.includes('cafe')) placeType = 'restaurant';
          else if (category.includes('parking')) placeType = 'parking';
          else if (category.includes('attraction')) placeType = 'attraction';
          else if (category.includes('park')) placeType = 'park';
          else if (category.includes('mall')) placeType = 'shopping';
          else if (category.includes('hotel')) placeType = 'hotel';
          const distance = Math.sqrt(Math.pow(lat - point[0], 2) + Math.pow(lng - point[1], 2)) * 111000;
          seenNames.add(name);
          places.push({
            name,
            lat,
            lng,
            type: placeType,
            address: feature.properties.address_line1 || '',
            distance: Math.round(distance),
            rating: feature.properties.rating || null,
          });
        });
      }
    }
  } catch (error) {
    console.error('API error, using mock data:', error);
  }

  if (places.length === 0) {
    console.log('No places from API, using mock data');
    const mockPlaces = getMockPlaces(routeCoords);
    mockPlaces.forEach(place => {
      if (!seenNames.has(place.name)) {
        seenNames.add(place.name);
        places.push(place);
      }
    });
  }
  places.sort((a, b) => a.distance - b.distance);
  return places.slice(0, 25);
};

const findPlacesNearPoint = async (lat, lng) => {
  try {
    if (!GEOAPIFY_API_KEY) {
      console.error('GEOAPIFY_API_KEY is not set');
      return [];
    }
    const categories = [
      'catering.restaurant',
      'catering.cafe',
      'parking',
      'tourism.attraction',
      'leisure.park',
      'commercial.shopping_mall',
      'accommodation.hotel',
    ];
    const url = `https://api.geoapify.com/v2/places?categories=${categories.join(',')}&filter=circle:${lng},${lat},5000&limit=20&apiKey=${GEOAPIFY_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.statusCode || data.message) {
      console.error('Geoapify API error:', data.statusCode, data.message);
      return [];
    }

    if (!data.features || data.features.length === 0) {
      console.warn('Geoapify returned no features for:', lat, lng);
      return [];
    }

    const places = [];
    const seenNames = new Set();
    data.features.forEach(feature => {
      const [lng2, lat2] = feature.geometry.coordinates;
      const name = feature.properties.name;
      if (!name || seenNames.has(name)) return;
      const category = feature.properties.categories?.[0] || '';
      let placeType = 'other';
      if (category.includes('restaurant') || category.includes('cafe')) placeType = 'restaurant';
      else if (category.includes('parking')) placeType = 'parking';
      else if (category.includes('attraction')) placeType = 'attraction';
      else if (category.includes('park')) placeType = 'park';
      else if (category.includes('mall')) placeType = 'shopping';
      else if (category.includes('hotel')) placeType = 'hotel';
      const distance = Math.sqrt(Math.pow(lat2 - lat, 2) + Math.pow(lng2 - lng, 2)) * 111000;
      seenNames.add(name);
      places.push({
        name,
        lat: lat2,
        lng: lng2,
        type: placeType,
        address: feature.properties.address_line1 || '',
        distance: Math.round(distance),
        rating: feature.properties.rating || null,
      });
    });
    places.sort((a, b) => a.distance - b.distance);
    return places.slice(0, 25);
  } catch (error) {
    console.error('Places near point error:', error);
    return [];
  }
};

// ========== Animated Polyline (unchanged from earlier version) ==========
const AnimatedPolyline = ({ positions, pathOptions, shouldAnimate }) => {
  const polylineRef = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (shouldAnimate && polylineRef.current && !hasAnimated) {
      const timeout = setTimeout(() => {
        const pathElement = polylineRef.current?.getElement?.();
        if (pathElement && typeof pathElement.getTotalLength === 'function') {
          const length = pathElement.getTotalLength();
          pathElement.style.strokeDasharray = length;
          pathElement.style.strokeDashoffset = length;
          pathElement.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.2, 0.9, 0.4, 1.1)';
          pathElement.style.strokeDashoffset = '0';
          setHasAnimated(true);
        }
      }, 50);
      return () => clearTimeout(timeout);
    }
  }, [shouldAnimate, hasAnimated, positions]);

  return <Polyline ref={polylineRef} positions={positions} pathOptions={pathOptions} />;
};
// =============================================================

const MapScreen = ({
  venueCoords,
  itineraryWaypoints,
  searchLabel,
  pickMode = false,
  pickContext = 'event',
  pickInitialCoords = null,
  pickHintLabel = '',
  returnPath = '/plan',
}) => {
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [showSearchPanel, setShowSearchPanel] = useState(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : true));
  const [showItineraryPanel, setShowItineraryPanel] = useState(true);
  const [showPlacesPanel, setShowPlacesPanel] = useState(false);

  const [pickedPoint, setPickedPoint] = useState(null);
  const [pickedLabel, setPickedLabel] = useState('');
  const [pickLoading, setPickLoading] = useState(false);

  const [originText, setOriginText] = useState('');
  const [destText, setDestText] = useState('');
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeSegments, setRouteSegments] = useState([]);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routeMode, setRouteMode] = useState('drive');
  const [flyTo, setFlyTo] = useState(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [trafficSummary, setTrafficSummary] = useState(null);
  const [weatherLocation, setWeatherLocation] = useState(null);

  const [originalDestination, setOriginalDestination] = useState(null);
  const [isRerouted, setIsRerouted] = useState(false);
  const [reroutedPlace, setReroutedPlace] = useState(null);

  const [placeTypeFilter, setPlaceTypeFilter] = useState('all');

  const [mapClickMode, setMapClickMode] = useState('origin');

  const defaultPosition = [10.3204, 123.9242];

  const [waypointsList, setWaypointsList] = useState([]);
  const [currentWaypointIndex, setCurrentWaypointIndex] = useState(0);

  const lastFetchedLocationRef = useRef(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (venueCoords?.lat && venueCoords?.lng) {
      const venueDest = { lat: venueCoords.lat, lng: venueCoords.lng, label: venueCoords.label || 'Event Venue' };
      setDestination(venueDest);
      setDestText(venueDest.label);
      setFlyTo([venueDest.lat, venueDest.lng]);
    }
  }, [venueCoords]);

  useEffect(() => {
    if (searchLabel) setDestText(searchLabel);
  }, [searchLabel]);

  useEffect(() => {
    if (itineraryWaypoints?.length) {
      setWaypointsList(itineraryWaypoints);
      setCurrentWaypointIndex(0);
      const first = itineraryWaypoints.find(w => w.lat && w.lng);
      if (first) {
        const dest = { lat: first.lat, lng: first.lng, label: first.label || 'Waypoint 1' };
        setDestination(dest);
        setDestText(dest.label);
        setFlyTo([dest.lat, dest.lng]);
      }
    }
  }, [itineraryWaypoints]);

  useEffect(() => {
    if (!pickMode || pickInitialCoords?.lat == null || pickInitialCoords?.lng == null) return;
    let cancelled = false;
    (async () => {
      setPickLoading(true);
      const { lat, lng } = pickInitialCoords;
      setPickedPoint({ lat, lng });
      setFlyTo([lat, lng]);
      const name = await reverseGeocodeLatLng(lat, lng);
      if (!cancelled) setPickedLabel(pickHintLabel || name);
      setPickLoading(false);
    })();
    return () => { cancelled = true; };
  }, [pickMode, pickInitialCoords?.lat, pickInitialCoords?.lng, pickHintLabel]);

  const handlePickMapClick = async (latlng) => {
    setPickLoading(true);
    setPickedPoint({ lat: latlng.lat, lng: latlng.lng });
    setFlyTo([latlng.lat, latlng.lng]);
    const name = await reverseGeocodeLatLng(latlng.lat, latlng.lng);
    setPickedLabel(name);
    setPickLoading(false);
  };

  const confirmPick = () => {
    if (!pickedPoint) return;
    try {
      const storageKey = `scheduleSkies_mapPick_${pickContext}`;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          context: pickContext,
          lat: pickedPoint.lat,
          lng: pickedPoint.lng,
          label: pickedLabel || `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`,
          ts: Date.now(),
        })
      );
    } catch (e) { console.error(e); }
    router.push(returnPath);
  };

  const cancelPick = () => router.push(returnPath);

  const goToNextWaypoint = () => {
    const nextIdx = currentWaypointIndex + 1;
    if (nextIdx < waypointsList.length) {
      setCurrentWaypointIndex(nextIdx);
      const wp = waypointsList[nextIdx];
      if (wp.lat && wp.lng) {
        const dest = { lat: wp.lat, lng: wp.lng, label: wp.label || `Stop ${nextIdx + 1}` };
        setDestination(dest);
        setDestText(dest.label);
        setFlyTo([dest.lat, dest.lng]);
        if (destination) {
          setOrigin(destination);
          setOriginText(destination.label);
        }
      }
    }
  };

  const getUserLocation = () => {
  if (!('geolocation' in navigator)) {
    alert('Geolocation is not supported by your browser.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      const { latitude: lat, longitude: lng } = position.coords;
      if (pickMode) {
        handlePickMapClick({ lat, lng });
        return;
      }
      const userLoc = { lat, lng, label: 'Your Location' };
      setUserLocation(userLoc);
      setOrigin(userLoc);
      setOriginText('Your Location');
      setFlyTo([lat, lng]);
      setWeatherLocation(userLoc);
    },
    error => {
      console.error('Geolocation error:', error.code, error.message);
      const messages = {
        1: 'Location permission denied. Please allow location access in your browser settings.',
        2: 'Your position could not be determined. Try again.',
        3: 'Location request timed out. Please try again.',
      };
      alert(messages[error.code] || 'Unable to get your location. Please enter it manually.');
    },
    {
      enableHighAccuracy: false,   // faster, less battery drain
      timeout: 10000,              // 10s before error callback
      maximumAge: 60000,           // accept a cached position up to 1 min old
    }
  );
};

  const handleMapSetOrigin = async latlng => {
    if (pickMode) return;
    const name = await reverseGeocodeLatLng(latlng.lat, latlng.lng);
    const newOrigin = { lat: latlng.lat, lng: latlng.lng, label: name || `Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}` };
    setOrigin(newOrigin);
    setUserLocation(newOrigin);
    setOriginText(newOrigin.label);
    setFlyTo([newOrigin.lat, newOrigin.lng]);
    setWeatherLocation(newOrigin);
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setTrafficSummary(null);
    if (destination) await fetchRoute(newOrigin, destination, routeMode, false);
  };

  const handleMapSetDestination = async latlng => {
    if (pickMode) return;
    const name = await reverseGeocodeLatLng(latlng.lat, latlng.lng);
    const newDest = { lat: latlng.lat, lng: latlng.lng, label: name || `Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}` };
    setDestination(newDest);
    setDestText(newDest.label);
    setFlyTo([newDest.lat, newDest.lng]);
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setTrafficSummary(null);
    setIsRerouted(false);
    setReroutedPlace(null);
    if (origin || userLocation) await fetchRoute(origin || userLocation, newDest, routeMode, false);
  };

  const fetchPlacesAlongRoute = async coords => {
    setIsLoadingPlaces(true);
    const places = await findPlacesAlongRoute(coords);
    setNearbyPlaces(places);
    setIsLoadingPlaces(false);
  };

  const fetchPlacesNearLocation = async (lat, lng) => {
    setIsLoadingPlaces(true);
    const places = await findPlacesNearPoint(lat, lng);
    setNearbyPlaces(places);
    setIsLoadingPlaces(false);
  };

  useEffect(() => {
    if (!pickMode && !origin && !userLocation && nearbyPlaces.length === 0) {
      fetchPlacesNearLocation(defaultPosition[0], defaultPosition[1]);
    }
  }, []);

  useEffect(() => {
    const currentLocation = origin || userLocation;
    if (!currentLocation) return;
    if (routeCoords?.length > 0) return;
    const { lat, lng } = currentLocation;
    if (lastFetchedLocationRef.current) {
      const dx = lastFetchedLocationRef.current.lat - lat;
      const dy = lastFetchedLocationRef.current.lng - lng;
      const dist = Math.sqrt(dx * dx + dy * dy) * 111000;
      if (dist < 50) return;
    }
    lastFetchedLocationRef.current = { lat, lng };
    fetchPlacesNearLocation(lat, lng);
  }, [origin, userLocation, routeCoords]);

  const handleOriginSelect = place => {
    setOrigin(place);
    setUserLocation(place);
    setFlyTo([place.lat, place.lng]);
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setTrafficSummary(null);
    setIsRerouted(false);
    setReroutedPlace(null);
  };

  const handleDestSelect = place => {
    setDestination(place);
    setFlyTo([place.lat, place.lng]);
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setTrafficSummary(null);
    setIsRerouted(false);
    setReroutedPlace(null);
  };

  const fetchRoute = async (org, dst, mode, isReroute = false) => {
    if (!org || !dst) {
      setRouteError('Please set both origin and destination.');
      return;
    }
    setIsRouting(true);
    setRouteError('');
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setTrafficSummary(null);

    try {
      const url = `https://api.geoapify.com/v1/routing?waypoints=${org.lat},${org.lng}|${dst.lat},${dst.lng}&mode=${mode}&apiKey=${GEOAPIFY_API_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.features?.length) {
        setRouteError('No route found.');
        setIsRouting(false);
        return;
      }
      const feature = data.features[0];
      let coords = [];
      if (feature.geometry.type === 'MultiLineString') {
        feature.geometry.coordinates.forEach(l => l.forEach(([lng, lat]) => coords.push([lat, lng])));
      } else if (feature.geometry.type === 'LineString') {
        feature.geometry.coordinates.forEach(([lng, lat]) => coords.push([lat, lng]));
      }
      setRouteCoords(coords);
      const segments = getRouteSegmentsWithTraffic(coords);
      setRouteSegments(segments);
      const summary = getTrafficSummary(segments);
      setTrafficSummary(summary);
      const baseTime = Math.round(feature.properties.time / 60);
      const adjustedTime = Math.round(baseTime * (summary.avgDelayFactor || 1));
      setRouteInfo({
        distance: (feature.properties.distance / 1000).toFixed(1),
        time: baseTime,
        adjustedTime,
        trafficDelay: adjustedTime - baseTime,
      });
      if (coords.length) {
        setFlyTo(coords[Math.floor(coords.length / 2)]);
        if (!isReroute) await fetchPlacesAlongRoute(coords);
      }
    } catch (error) {
      console.error('Route fetch error:', error);
      setRouteError('Failed to fetch route.');
    }
    setIsRouting(false);
  };

  const handleRerouteToPlace = async place => {
    if (!origin && !userLocation) {
      alert('Please set an origin first (use "My Location" or enter a starting point)');
      return;
    }
    const currentOrigin = origin || userLocation;
    if (!isRerouted && destination) setOriginalDestination(destination);
    setDestination(place);
    setDestText(place.name);
    setReroutedPlace(place);
    setIsRerouted(true);
    await fetchRoute(currentOrigin, place, routeMode, true);
    setFlyTo([place.lat, place.lng]);
  };

  const undoReroute = async () => {
    if (originalDestination) {
      const currentOrigin = origin || userLocation;
      setDestination(originalDestination);
      setDestText(originalDestination.label);
      setIsRerouted(false);
      setReroutedPlace(null);
      await fetchRoute(currentOrigin, originalDestination, routeMode, false);
      setFlyTo([originalDestination.lat, originalDestination.lng]);
    }
  };

  const getPlaceIconForCard = type => {
    switch (type) {
      case 'restaurant': return '🍽️';
      case 'parking': return '🅿️';
      case 'attraction': return '🏛️';
      case 'park': return '🌳';
      case 'shopping': return '🛍️';
      case 'hotel': return '🏨';
      default: return '📍';
    }
  };

  const getFilteredPlaces = () => {
    if (placeTypeFilter === 'all') return nearbyPlaces;
    return nearbyPlaces.filter(place => place.type === placeTypeFilter);
  };

  const clearAll = () => {
    setOrigin(null);
    setDestination(null);
    setOriginText('');
    setDestText('');
    setRouteCoords(null);
    setRouteSegments([]);
    setRouteInfo(null);
    setRouteError('');
    setNearbyPlaces([]);
    setTrafficSummary(null);
    setIsRerouted(false);
    setReroutedPlace(null);
    setOriginalDestination(null);
    setFlyTo(defaultPosition);
  };

  useEffect(() => {
    if (origin) setWeatherLocation(origin);
    else if (userLocation) setWeatherLocation(userLocation);
  }, [origin, userLocation]);

  useEffect(() => {
    setWeatherLocation({ lat: 10.3204, lng: 123.9242 });
  }, []);

  const modeOptions = [
    { key: 'drive', icon: '🚗', label: 'Drive' },
    { key: 'walk', icon: '🚶', label: 'Walk' },
    { key: 'transit', icon: '🚌', label: 'Transit' },
  ];

  const pinSvg = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
    <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
  </svg>
);

const placeFilterOptions = [
  { key: 'all',        label: 'All',         icon: pinSvg },
  { key: 'restaurant', label: 'Restaurants', icon: getPlaceIcon('restaurant', 13) },
  { key: 'parking',    label: 'Parking',     icon: getPlaceIcon('parking',    13) },
  { key: 'attraction', label: 'Attractions', icon: getPlaceIcon('attraction', 13) },
  { key: 'park',       label: 'Parks',       icon: getPlaceIcon('park',       13) },
  { key: 'shopping',   label: 'Shopping',    icon: getPlaceIcon('shopping',   13) },
  { key: 'hotel',      label: 'Hotels',      icon: getPlaceIcon('hotel',      13) },
];

  const mapContent = (
    <>
      <MapResizeHelper />
      <TileLayer
        url={`https://maps.geoapify.com/v1/tile/${mapStyle}/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`}
        attribution='Powered by Geoapify | OpenStreetMap'
      />
      {flyTo && <FlyTo coords={flyTo} />}
      {pickMode && <MapPickClickHandler enabled={pickMode} onLatLngClick={handlePickMapClick} />}
      {!pickMode && (
        <MapClickHandler
          mode={mapClickMode}
          onSetOrigin={handleMapSetOrigin}
          onSetDestination={handleMapSetDestination}
          isLocked={!pickMode && origin !== null && destination !== null}
        />
      )}
      {pickMode && pickedPoint && <Marker position={[pickedPoint.lat, pickedPoint.lng]} icon={destIcon}><Popup><strong>Pinned location</strong><br />{pickedLabel || `${pickedPoint.lat.toFixed(5)}, ${pickedPoint.lng.toFixed(5)}`}</Popup></Marker>}
      {userLocation && !origin && !pickMode && <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}><Popup><strong>Your Location</strong></Popup></Marker>}
      {!pickMode && origin && <Marker position={[origin.lat, origin.lng]} icon={originIcon}><Popup><strong>Origin</strong><br />{origin.label}</Popup></Marker>}
      {!pickMode && destination && <Marker position={[destination.lat, destination.lng]} icon={destIcon}><Popup><strong>Destination</strong><br />{destination.label}{isRerouted && <div style={{ color: '#FF9800', marginTop: '5px' }}>Rerouted</div>}</Popup></Marker>}
      {!pickMode && routeSegments.map((segment, idx) => (
        <AnimatedPolyline 
          key={idx} 
          positions={[segment.start, segment.end]} 
          pathOptions={{ color: segment.color, weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
          shouldAnimate={!!routeSegments.length && idx === 0}
        />
      ))}
      {!pickMode && getFilteredPlaces().map((place, idx) => (
        <Marker key={idx} position={[place.lat, place.lng]} icon={createPlacePin(place.type, false)}>
          <Popup>
            <strong>{place.name}</strong><br />
            {place.rating && <span>⭐ Rating: {place.rating}/5<br /></span>}
            <span>Type: {place.type}<br /></span>
            {place.address && <span>{place.address}<br /></span>}
            <span>Distance: {place.distance}m</span><br />
            <button onClick={() => handleRerouteToPlace(place)} style={{ marginTop: '8px', padding: '5px 10px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '11px' }}>Reroute Here</button>
          </Popup>
        </Marker>
      ))}
    </>
  );

  // ========== Bottom Sheet with Framer Motion ==========
 // ========== UPDATED: Beautiful Bottom Sheet with Slide-Up Animation ==========
const renderPlacesBottomSheet = () => (
  <AnimatePresence>
    {showPlacesPanel && (
      <>
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={() => setShowPlacesPanel(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1001,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(2px)',
            pointerEvents: 'auto',
          }}
        />
        <motion.div
          key="sheet"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 280, mass: 0.8 }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1002,
            pointerEvents: 'auto',
            background: '#ffffff',
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.12)',
            maxHeight: isMobile ? '65vh' : '55vh',
            width: isMobile ? '100%' : 'auto',
            maxWidth: isMobile ? '100%' : '1000px',
            margin: isMobile ? '0' : '0 auto',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Custom scrollbar styles */}
          <style jsx>{`
            div::-webkit-scrollbar {
              width: 4px;
            }
            div::-webkit-scrollbar-track {
              background: #f1f1f1;
              border-radius: 10px;
            }
            div::-webkit-scrollbar-thumb {
              background: #cbd5e0;
              border-radius: 10px;
            }
          `}</style>

          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
            <div style={{ width: '40px', height: '4px', background: '#cbd5e0', borderRadius: '4px' }} />
          </div>

          {/* Header with gradient */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)',
              margin: '0 16px 12px 16px',
              borderRadius: '20px',
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
                <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
              </svg>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
                  Suggested Places
                </div>
                <div style={{ fontSize: '10px', color: '#bee3f8', marginTop: '2px' }}>
                  {nearbyPlaces.length} spots nearby
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowPlacesPanel(false)}
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: 'none',
                borderRadius: '30px',
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '16px',
                backdropFilter: 'blur(4px)',
              }}
            >
              ✕
            </button>
          </div>

          {/* Filter chips */}
          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              padding: '0 16px 12px 16px',
              borderBottom: '1px solid #edf2f7',
            }}
          >
            {placeFilterOptions.map(option => (
              <button
                key={option.key}
                onClick={() => setPlaceTypeFilter(option.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '40px',
                  border: 'none',
                  background: placeTypeFilter === option.key
                    ? 'linear-gradient(135deg, #2c5282, #2b6cb0)'
                    : '#f0f4f8',
                  color: placeTypeFilter === option.key ? 'white' : '#2d3748',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: placeTypeFilter === option.key ? '0 2px 8px rgba(43,108,176,0.3)' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (placeTypeFilter !== option.key) e.currentTarget.style.background = '#e2e8f0';
                }}
                onMouseLeave={e => {
                  if (placeTypeFilter !== option.key) e.currentTarget.style.background = '#f0f4f8';
                }}
              >
                <span style={{ fontSize: '13px' }}>{option.icon}</span> {option.label}
              </button>
            ))}
          </div>

          {/* Places list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px' }}>
            {getFilteredPlaces().length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '13px',
                  color: '#718096',
                  padding: '32px 16px',
                  background: '#f7fafc',
                  borderRadius: '20px',
                }}
              >
                ✨ No places found. Try a different filter.
              </div>
            ) : (
              getFilteredPlaces().map((place, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)',
                    border: '1px solid #edf2f7',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  whileHover={{ scale: 1.01, boxShadow: '0 8px 20px rgba(0,0,0,0.08)' }}
                  onClick={() => handleRerouteToPlace(place)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '12px' }}>
                    {/* Icon / Emoji with gradient background */}
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        background: `linear-gradient(135deg, ${getPlaceColor(place.type)}20, ${getPlaceColor(place.type)}40)`,
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        marginRight: '14px',
                      }}
                    >
                      {getPlaceIcon(place.type, 24, getPlaceColor(place.type))}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#1a202c', margin: 0 }}>
                            {place.name}
                          </h4>
                          {place.address && (
                            <p style={{ fontSize: '10px', color: '#718096', margin: '4px 0 0', lineHeight: 1.3 }}>
                              {place.address.length > 45 ? `${place.address.substring(0, 45)}…` : place.address}
                            </p>
                          )}
                        </div>
                        {place.rating && (
                          <div
                            style={{
                              background: '#fef5e7',
                              padding: '3px 8px',
                              borderRadius: '30px',
                              fontSize: '11px',
                              fontWeight: '600',
                              color: '#d69e2e',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ⭐ {place.rating.toFixed(1)}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            background: '#f0f4f8',
                            padding: '3px 10px',
                            borderRadius: '30px',
                            color: '#2c5282',
                            fontWeight: '600',
                            textTransform: 'capitalize',
                          }}
                        >
                          {place.type}
                        </span>
                        <span style={{ fontSize: '10px', color: '#4a5568', display: 'flex', alignItems: 'center', gap: '3px' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="red" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
                            <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
                          </svg>
                          {place.distance}m away
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action button (subtle) */}
                  <div
                    style={{
                      borderTop: '1px solid #edf2f7',
                      padding: '8px 12px',
                      background: '#fafcff',
                      display: 'flex',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#ff9800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      Reroute here →
                    </span>
                  </div>
                </motion.div>
              ))
            )}
          </div>

          {/* Reroute undo banner */}
          {isRerouted && reroutedPlace && (
            <div style={{ padding: '12px 16px 20px', borderTop: '1px solid #edf2f7', background: '#fffaf0' }}>
              <div
                style={{
                  background: '#fff3e0',
                  padding: '10px 14px',
                  borderRadius: '16px',
                  border: '1px solid #ffe0b5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>🔄</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#e65100' }}>Currently rerouted</div>
                    <div style={{ fontSize: '11px', color: '#bf360c' }}>To: <strong>{reroutedPlace.name}</strong></div>
                  </div>
                </div>
                <button
                  onClick={undoReroute}
                  style={{
                    padding: '6px 12px',
                    background: '#ff9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '30px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '600',
                    boxShadow: '0 2px 6px rgba(255,152,0,0.3)',
                  }}
                >
                  Undo reroute
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </>
    )}
  </AnimatePresence>
);

  const mapShellLeft = isMobile ? 0 : 80;
  const mapShellWidth = isMobile ? '100vw' : 'calc(100vw - 80px)';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: mapShellLeft,
        width: mapShellWidth,
        minHeight: '100vh',
        height: '100dvh',
        zIndex: 1,
        fontFamily: "'Segoe UI', sans-serif",
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1 }}>
        {typeof window !== 'undefined' && (
          <MapContainer
            key={isMobile ? 'map-sm' : 'map-lg'}
            center={defaultPosition}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            {mapContent}
          </MapContainer>
        )}
      </div>

      {pickMode ? (
        <div style={{ position: 'absolute', top: '20px', left: '10px', right: '10px', zIndex: 1002, pointerEvents: 'auto', background: 'rgba(255,255,255,0.97)', borderRadius: '18px', padding: '14px 16px', boxShadow: '0 4px 18px rgba(0,0,0,0.13)' }}>
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#1A365D', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A365D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
              <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z"/>
            </svg>
            Pin your {isActivityPickContext(pickContext) ? 'activity' : 'event'} location
          </div>
          <p style={{ fontSize: '12px', color: '#4A5568', margin: '0 0 10px', lineHeight: 1.45 }}>Tap anywhere on the map to place or move the pin.{pickHintLabel ? <span style={{ display: 'block', marginTop: '6px', fontSize: '11px', opacity: 0.85 }}>Hint: {pickHintLabel}</span> : null}</p>
          {pickLoading && <div style={{ fontSize: '11px', color: '#718096', marginBottom: '8px' }}>Resolving address…</div>}
          {pickedLabel && <div style={{ fontSize: '11px', color: '#2C5282', marginBottom: '10px', padding: '8px 10px', background: '#EBF8FF', borderRadius: '10px', maxHeight: '72px', overflowY: 'auto' }}>{pickedLabel}</div>}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" onClick={confirmPick} disabled={!pickedPoint || pickLoading} style={{ padding: '8px 16px', borderRadius: '10px', border: 'none', background: !pickedPoint || pickLoading ? '#A0AEC0' : '#15A862', color: 'white', fontWeight: 700, fontSize: '13px', cursor: !pickedPoint || pickLoading ? 'not-allowed' : 'pointer' }}>Use this location</button>
            <button type="button" onClick={cancelPick} style={{ padding: '8px 16px', borderRadius: '10px', border: '1px solid #CBD5E0', background: 'white', color: '#4A5568', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            <button type="button" onClick={getUserLocation} style={{ padding: '8px 12px', borderRadius: '10px', border: 'none', background: '#2C5282', color: 'white', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap', marginLeft: 'auto' }}>My location</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ position: 'absolute', top: '10px', left: '10px', right: '10px', zIndex: 1002, pointerEvents: 'auto', display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
            <WeatherWidget location={weatherLocation} isMobile={true} />
            {trafficSummary && routeInfo && (
              <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: '25px', gap: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', background: trafficSummary.level === 'Heavy' ? 'linear-gradient(135deg, #FF5252, #C62828)' : trafficSummary.level === 'Moderate' ? 'linear-gradient(135deg, #FFB74D, #F57F17)' : 'linear-gradient(135deg, #66BB6A, #4CAF50)', color: 'white' }}>
                <span style={{ fontSize: '16px' }}>{trafficSummary.level === 'Heavy' ? '🔴' : trafficSummary.level === 'Moderate' ? '🟠' : '🟢'}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: '700', fontSize: '11px' }}>{trafficSummary.level}</span>
                  <span style={{ fontSize: '8px', opacity: 0.9 }}>+{routeInfo.trafficDelay} min</span>
                </div>
              </div>
            )}
          </div>

          {!pickMode && (
            <div style={{ position: 'absolute', top: '50px', left: '10px', right: '10px', zIndex: 1002, pointerEvents: 'auto', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowSearchPanel(!showSearchPanel)} style={{ backgroundColor: showSearchPanel ? '#2C5282' : '#ffffff', color: showSearchPanel ? 'white' : '#2C5282', border: 'none', borderRadius: '30px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <path d="M8 7v13M16 7v13M3 11h18M3 15h5M16 15h5"/>
                </svg>
                {showSearchPanel ? 'Hide Route' : 'Show Route'}
              </button>

              <button onClick={() => setShowPlacesPanel(!showPlacesPanel)} style={{ backgroundColor: showPlacesPanel ? '#FF9800' : '#ffffff', color: showPlacesPanel ? 'white' : '#FF9800', border: 'none', borderRadius: '30px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 11m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
                  <path d="M17.657 16.657l-4.243 4.243a2 2 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"/>
                </svg>
                {showPlacesPanel ? 'Hide Places' : 'Show Places'}
              </button>

              {waypointsList.length > 0 && (
                <button onClick={() => setShowItineraryPanel(!showItineraryPanel)} style={{ backgroundColor: showItineraryPanel ? '#7B1FA2' : '#ffffff', color: showItineraryPanel ? 'white' : '#7B1FA2', border: 'none', borderRadius: '30px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 5h-2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-12a2 2 0 0 0-2-2h-2"/>
                    <path d="M9 3m0 2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"/>
                    <path d="M9 12h6M9 16h6"/>
                  </svg>
                  {showItineraryPanel ? 'Hide Itinerary' : 'Show Itinerary'}
                </button>
              )}
            </div>
          )}

          {/* Animated Search Panel with Scale */}
          {/* Animated Search Panel with Premium Design */}
<AnimatePresence>
  {showSearchPanel && (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
      style={{
        position: 'absolute',
        top: '100px',
        left: '10px',
        right: '10px',
        zIndex: 1002,
        pointerEvents: 'auto',
        background: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(10px)',
        borderRadius: '28px',
        boxShadow: '0 20px 35px -12px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.02)',
        overflow: 'hidden',
        transformOrigin: 'top center',
      }}
    >
      {/* Header with gradient */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7l6-3l6 3l6-3v13l-6 3l-6-3l-6 3z"/>
            <path d="M9 4v13M15 7v13"/>
          </svg>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
              Route Planner
            </div>
            <div style={{ fontSize: '11px', color: '#bee3f8', marginTop: '2px' }}>
              Plan your journey
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowSearchPanel(false)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '30px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            fontSize: '18px',
            backdropFilter: 'blur(4px)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >
          ✕
        </button>
      </div>

      {/* Main content */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Origin input with my location button */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <SearchInput
                placeholder="From – your starting point"
                value={originText}
                onChange={setOriginText}
                onSelect={handleOriginSelect}
                icon="🟦"
                isMobile={true}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={getUserLocation}
              style={{ padding: '10px 12px', borderRadius: '16px', border: 'none', background: '#edf2f7', color: '#2c5282', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Use my current location"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2c5282" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
              </svg>
            </motion.button>
          </div>

          {/* Destination input */}
          <SearchInput
            placeholder="To – your destination"
            value={destText}
            onChange={setDestText}
            onSelect={handleDestSelect}
            icon="🔴"
            isMobile={true}
          />

          {/* Mode selector + actions row */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginTop: '4px' }}>
            {/* Map click mode toggle */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                background: '#f0f4f8',
                borderRadius: '40px',
                padding: '4px',
              }}
            >
              <button
                onClick={() => setMapClickMode('origin')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '32px',
                  border: 'none',
                  background: mapClickMode === 'origin' ? '#2c5282' : 'transparent',
                  color: mapClickMode === 'origin' ? 'white' : '#4a5568',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Set origin
              </button>
              <button
                onClick={() => setMapClickMode('destination')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '32px',
                  border: 'none',
                  background: mapClickMode === 'destination' ? '#2c5282' : 'transparent',
                  color: mapClickMode === 'destination' ? 'white' : '#4a5568',
                  fontWeight: '600',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Set destination
              </button>
            </div>

            {/* Travel mode selector */}
            <div style={{ display: 'flex', gap: '6px', background: '#f0f4f8', borderRadius: '40px', padding: '4px' }}>
              {modeOptions.map(({ key, icon, label }) => (
                <motion.button
                  key={key}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRouteMode(key)}
                  title={label}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '32px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    transition: 'all 0.2s',
                    background: routeMode === key ? '#2c5282' : 'transparent',
                    color: routeMode === key ? 'white' : '#4a5568',
                  }}
                >
                  {icon}
                </motion.button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => fetchRoute(origin || userLocation, destination, routeMode, false)}
                disabled={isRouting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '30px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #2c5282, #2b6cb0)',
                  color: 'white',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: isRouting ? 'not-allowed' : 'pointer',
                  opacity: isRouting ? 0.6 : 1,
                  boxShadow: '0 4px 10px rgba(43,108,176,0.3)',
                }}
              >
                {isRouting ? '⏳ Routing...' : 'Go →'}
              </motion.button>

              {isRerouted && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={undoReroute}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '30px',
                    border: 'none',
                    background: '#ff9800',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Undo
                </motion.button>
              )}

              {(origin || destination || routeCoords) && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={clearAll}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '30px',
                    border: 'none',
                    background: '#fed7d7',
                    color: '#c53030',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Clear all
                </motion.button>
              )}
            </div>
          </div>

          {/* Error or route info */}
          {routeError && (
            <div
              style={{
                background: '#fff5f5',
                padding: '10px 16px',
                borderRadius: '20px',
                fontSize: '12px',
                color: '#e53e3e',
                border: '1px solid #fed7d7',
              }}
            >
              ⚠️ {routeError}
            </div>
          )}

          {routeInfo && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: '#ebf8ff',
                padding: '12px 16px',
                borderRadius: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                border: '1px solid #bee3f8',
              }}
            >
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#2c5282', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📏 {routeInfo.distance} km
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#2c5282', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  ⏱ {routeInfo.adjustedTime} min
                </span>
                {routeInfo.trafficDelay > 0 && (
                  <span style={{ fontSize: '12px', color: '#d69e2e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    🚦 +{routeInfo.trafficDelay} min delay
                  </span>
                )}
              </div>
              {trafficSummary && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '10px',
                      background:
                        trafficSummary.level === 'Heavy'
                          ? '#c62828'
                          : trafficSummary.level === 'Moderate'
                          ? '#f57f17'
                          : '#4caf50',
                    }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: '600', color: '#4a5568' }}>
                    Traffic: {trafficSummary.level}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  )}
</AnimatePresence>

          {!pickMode && renderPlacesBottomSheet()}

          {!pickMode && waypointsList.length > 0 && showItineraryPanel && (
            <div style={{ position: 'absolute', bottom: '80px', right: '10px', left: '10px', zIndex: 1002, pointerEvents: 'auto', background: '#EDE7F6', borderRadius: '18px', padding: '12px', boxShadow: '0 4px 18px rgba(0,0,0,0.13)', maxHeight: '40%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#4A148C' }}>🗺️ Itinerary • Stop {currentWaypointIndex + 1}/{waypointsList.length}</div>
                <button onClick={() => setShowItineraryPanel(false)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666' }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', justifyContent: 'center' }}>
                {waypointsList.map((_, i) => <div key={i} style={{ width: i === currentWaypointIndex ? '24px' : '6px', height: '6px', borderRadius: '3px', background: i < currentWaypointIndex ? '#7B1FA2' : i === currentWaypointIndex ? '#AB47BC' : '#D1C4E9', transition: 'all 0.3s ease' }}></div>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                {waypointsList.map((wp, i) => (
                  <div key={i} style={{ backgroundColor: i === currentWaypointIndex ? 'white' : i < currentWaypointIndex ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.3)', borderRadius: '8px', padding: '6px 8px', fontSize: '10px', fontWeight: i === currentWaypointIndex ? '700' : '400', color: '#1A365D' }}>
                    {i + 1}. {wp.label || wp.activityName || `Stop ${i + 1}`}
                  </div>
                ))}
              </div>
              {currentWaypointIndex < waypointsList.length - 1 && <button onClick={goToNextWaypoint} style={{ marginTop: '8px', padding: '8px', background: 'linear-gradient(135deg, #7B1FA2, #AB47BC)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', width: '100%' }}>Next Stop →</button>}
            </div>
          )}
        </>
      )}

      {isLoadingPlaces && (
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', zIndex: 1002 }}>
          Finding places near you...
        </div>
      )}
    </div>
  );
};

export default MapScreen;