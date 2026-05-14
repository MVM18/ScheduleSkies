import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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

const createIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:${color};border:2px solid white;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 18],
});

const createHighlightedIcon = (color) => L.divIcon({
  className: '',
  html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${color};border:3px solid #FFD700;transform:rotate(-45deg);box-shadow:0 0 0 2px white, 0 4px 12px rgba(0,0,0,0.5);transition: all 0.2s;"></div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

const originIcon = createIcon('#2C5282');
const originIconHighlight = createHighlightedIcon('#2C5282');
const destIcon = createIcon('#E53E3E');
const destIconHighlight = createHighlightedIcon('#E53E3E');
const userLocationIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#2C5282;border:2px solid white;border-radius:50%;box-shadow:0 0 0 2px #2C5282;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});
const userLocationIconHighlight = L.divIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:#2C5282;border:3px solid #FFD700;border-radius:50%;box-shadow:0 0 0 2px white, 0 0 0 4px #2C5282;transition: all 0.2s;"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
const getPlaceEmoji = (type) => {
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
  const emoji = getPlaceEmoji(type);
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
              style={{ padding: isMobile ? '8px 12px' : '10px 14px', fontSize: isMobile ? '11px' : '12px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none', color: '#333' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EBF4FF')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              📍 {s.properties.formatted}
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
    const categories = [
      'catering.restaurant',
      'catering.cafe',
      'parking',
      'tourism.attraction',
      'leisure.park',
      'shopping.mall',
      'accommodation.hotel',
    ];
    const url = `https://api.geoapify.com/v2/places?categories=${categories.join(',')}&filter=circle:${lng},${lat},1500&limit=20&apiKey=${GEOAPIFY_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

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
    if ('geolocation' in navigator) {
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
          console.error(error);
          alert('Unable to get your location. Please enter it manually.');
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
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

  const placeFilterOptions = [
    { key: 'all', label: 'All', icon: '📍' },
    { key: 'restaurant', label: 'Restaurants', icon: '🍽️' },
    { key: 'parking', label: 'Parking', icon: '🅿️' },
    { key: 'attraction', label: 'Attractions', icon: '🏛️' },
    { key: 'park', label: 'Parks', icon: '🌳' },
    { key: 'shopping', label: 'Shopping', icon: '🛍️' },
    { key: 'hotel', label: 'Hotels', icon: '🏨' },
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
      {!pickMode && routeSegments.map((segment, idx) => <Polyline key={idx} positions={[segment.start, segment.end]} pathOptions={{ color: segment.color, weight: 6, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />)}
      {!pickMode && getFilteredPlaces().map((place, idx) => (
        <Marker key={idx} position={[place.lat, place.lng]} icon={createPlaceIcon(place.type, false)}>
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

  const renderPlacesBottomSheet = () => (
    <>
      <div
        onClick={() => setShowPlacesPanel(false)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1001,
          background: 'rgba(0, 0, 0, 0.3)',
          pointerEvents: 'auto',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: isMobile ? '100px' : 0,
          left: 0,
          right: 0,
          zIndex: 1002,
          pointerEvents: 'auto',
          background: 'white',
          borderTopLeftRadius: '20px',
          borderTopRightRadius: '20px',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
          maxHeight: isMobile ? '40vh' : '50vh',
          width: isMobile ? '100%' : 'auto',
          maxWidth: isMobile ? '100%' : '1000px',
          margin: isMobile ? '2' : '0 auto',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '6px', marginBottom: '4px' }}>
          <div style={{ width: '32px', height: '4px', background: '#CBD5E0', borderRadius: '2px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px 8px', borderBottom: '1px solid #EDF2F7' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#1A365D' }}>📍 Suggested Places</div>
          <button onClick={() => setShowPlacesPanel(false)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666', padding: '2px 6px' }}>✕</button>
        </div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', padding: '6px 10px', borderBottom: '1px solid #EDF2F7' }}>
          {placeFilterOptions.map(option => (
            <button
              key={option.key}
              onClick={() => setPlaceTypeFilter(option.key)}
              style={{
                padding: '3px 8px',
                borderRadius: '12px',
                border: 'none',
                background: placeTypeFilter === option.key ? '#2C5282' : '#EDF2F7',
                color: placeTypeFilter === option.key ? 'white' : '#333',
                cursor: 'pointer',
                fontSize: '9px',
                fontWeight: '600',
              }}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '8px 10px' }}>
          {getFilteredPlaces().length === 0 ? (
            <div style={{ textAlign: 'center', fontSize: '10px', color: '#666', padding: '16px' }}>No places found</div>
          ) : (
            getFilteredPlaces().map((place, i) => (
              <div
                key={i}
                style={{
                  background: '#f8f9fa',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <div style={{ height: '36px', background: `linear-gradient(135deg, ${getPlaceColor(place.type)}80, ${getPlaceColor(place.type)})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                  {getPlaceIconForCard(place.type)}
                </div>
                <div style={{ padding: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2px' }}>
                    <h4 style={{ fontSize: '9px', fontWeight: '700', color: '#1A365D', margin: 0, flex: 1 }}>{place.name}</h4>
                    {place.rating && <div style={{ fontSize: '7px', fontWeight: '600', color: '#FFB800' }}>⭐ {place.rating}</div>}
                  </div>
                  {place.address && <p style={{ fontSize: '6px', color: '#5a6b7c', margin: '0 0 2px', lineHeight: 1.2 }}>{place.address.length > 40 ? `${place.address.substring(0, 40)}…` : place.address}</p>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{ fontSize: '6px', background: '#EDF2F7', padding: '1px 3px', borderRadius: '8px', color: '#2C5282', fontWeight: '500' }}>{place.type}</span>
                      <span style={{ fontSize: '6px', color: '#4A5568' }}>📍 {place.distance}m</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRerouteToPlace(place)}
                    style={{
                      width: '100%',
                      padding: '3px 5px',
                      background: '#FF9800',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '8px',
                      fontWeight: '600',
                    }}
                  >
                    Reroute Here
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {isRerouted && reroutedPlace && (
          <div style={{ padding: '8px 10px', borderTop: '1px solid #EDF2F7' }}>
            <div style={{ background: '#FFF3E0', padding: '6px', borderRadius: '8px', border: '1px solid #FF9800' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#E65100', marginBottom: '2px' }}>Currently Rerouted</div>
              <div style={{ fontSize: '9px', color: '#BF360C', marginBottom: '2px' }}>To: <strong>{reroutedPlace.name}</strong></div>
              <button onClick={undoReroute} style={{ width: '100%', padding: '4px 6px', background: '#FF9800', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '9px', fontWeight: '600' }}>Undo Reroute</button>
            </div>
          </div>
        )}
      </div>
    </>
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
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#1A365D', marginBottom: '8px' }}>📍 Pin your {isActivityPickContext(pickContext) ? 'activity' : 'event'} location</div>
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
            <div style={{ position: 'absolute', top: '80px', left: '10px', right: '10px', zIndex: 1002, pointerEvents: 'auto', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowSearchPanel(!showSearchPanel)} style={{ backgroundColor: showSearchPanel ? '#2C5282' : '#ffffff', color: showSearchPanel ? 'white' : '#2C5282', border: 'none', borderRadius: '30px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
                🗺️ {showSearchPanel ? 'Hide Route' : 'Show Route'}
              </button>
              <button onClick={() => setShowPlacesPanel(!showPlacesPanel)} style={{ backgroundColor: showPlacesPanel ? '#FF9800' : '#ffffff', color: showPlacesPanel ? 'white' : '#FF9800', border: 'none', borderRadius: '30px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
                📍 {showPlacesPanel ? 'Hide Places' : 'Show Places'}
              </button>
              {waypointsList.length > 0 && (
                <button onClick={() => setShowItineraryPanel(!showItineraryPanel)} style={{ backgroundColor: showItineraryPanel ? '#7B1FA2' : '#ffffff', color: showItineraryPanel ? 'white' : '#7B1FA2', border: 'none', borderRadius: '30px', padding: '8px 16px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)', cursor: 'pointer' }}>
                  📋 {showItineraryPanel ? 'Hide Itinerary' : 'Show Itinerary'}
                </button>
              )}
            </div>
          )}

          {showSearchPanel && (
            <div style={{ position: 'absolute', top: '130px', left: '10px', right: '10px', zIndex: 1002, pointerEvents: 'auto', background: 'rgba(255,255,255,0.97)', borderRadius: '18px', padding: '12px', boxShadow: '0 4px 18px rgba(0,0,0,0.13)', maxHeight: '50%', overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}><div style={{ fontSize: '12px', fontWeight: '800', color: '#1A365D' }}>📍 Route Planner</div><button onClick={() => setShowSearchPanel(false)} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#666' }}>✕</button></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <SearchInput placeholder="From" value={originText} onChange={setOriginText} onSelect={handleOriginSelect} icon="🟦" isMobile={true} />
                  <button onClick={getUserLocation} style={{ padding: '6px 10px', borderRadius: '10px', border: 'none', background: '#2C5282', color: 'white', cursor: 'pointer', fontSize: '11px', whiteSpace: 'nowrap' }}>📍</button>
                </div>
                <SearchInput placeholder="To" value={destText} onChange={setDestText} onSelect={handleDestSelect} icon="🔴" isMobile={true} />
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '4px', background: '#EDF2F7', borderRadius: '20px', padding: '2px' }}>
                    <button onClick={() => setMapClickMode('origin')} style={{ padding: '3px 8px', borderRadius: '16px', border: 'none', background: mapClickMode === 'origin' ? '#2C5282' : 'transparent', color: mapClickMode === 'origin' ? 'white' : '#4A5568', fontWeight: '600', fontSize: '9px', cursor: 'pointer' }}>Origin</button>
                    <button onClick={() => setMapClickMode('destination')} style={{ padding: '3px 8px', borderRadius: '16px', border: 'none', background: mapClickMode === 'destination' ? '#2C5282' : 'transparent', color: mapClickMode === 'destination' ? 'white' : '#4A5568', fontWeight: '600', fontSize: '9px', cursor: 'pointer' }}>Dest</button>
                  </div>
                  {modeOptions.map(({ key, icon, label }) => (
                    <button key={key} onClick={() => setRouteMode(key)} title={label} style={{ padding: '5px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s', background: routeMode === key ? '#2C5282' : '#EDF2F7', transform: routeMode === key ? 'scale(1.1)' : 'scale(1)' }}>{icon}</button>
                  ))}
                  <button onClick={() => fetchRoute(origin || userLocation, destination, routeMode, false)} disabled={isRouting} style={{ marginLeft: 'auto', padding: '6px 16px', borderRadius: '10px', border: 'none', background: '#2C5282', color: 'white', fontWeight: '700', fontSize: '12px', cursor: isRouting ? 'not-allowed' : 'pointer', opacity: isRouting ? 0.6 : 1 }}>{isRouting ? '...' : 'Go'}</button>
                  {isRerouted && <button onClick={undoReroute} style={{ padding: '6px 8px', borderRadius: '8px', border: 'none', background: '#FF9800', color: 'white', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>Undo</button>}
                  {(origin || destination || routeCoords) && <button onClick={clearAll} style={{ padding: '6px 8px', borderRadius: '8px', border: 'none', background: '#FED7D7', color: '#C53030', fontSize: '11px', cursor: 'pointer', fontWeight: '700' }}>Clear</button>}
                </div>
                {routeError && <div style={{ fontSize: '11px', color: '#E53E3E', padding: '5px 8px', background: '#FFF5F5', borderRadius: '8px' }}>⚠️ {routeError}</div>}
                {routeInfo && (
                  <div style={{ display: 'flex', gap: '8px', padding: '5px 10px', background: '#EBF8FF', borderRadius: '8px', fontSize: '11px', fontWeight: '700', color: '#2C5282', justifyContent: 'space-between' }}>
                    <span>📏 {routeInfo.distance} km</span>
                    <span>⏱ {routeInfo.adjustedTime} min</span>
                    {routeInfo.trafficDelay > 0 && <span>🚦 +{routeInfo.trafficDelay} min</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {!pickMode && nearbyPlaces.length > 0 && showPlacesPanel && renderPlacesBottomSheet()}

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