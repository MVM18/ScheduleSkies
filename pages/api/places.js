const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export default async function handler(req, res) {
  const { ll, radius, limit } = req.query;

  // Guard: missing API key — return empty gracefully instead of crashing
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(200).json({ places: [], _notice: 'GOOGLE_PLACES_API_KEY not configured' });
  }

  if (!ll) {
    return res.status(400).json({ error: 'll (lat,lng) parameter is required' });
  }

  const cacheKey = `${ll}-${radius}-${limit}`;

  // Return cached result if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  const parts = ll.split(',');
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Invalid ll parameter — expected "lat,lng"' });
  }

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.photos,places.types,places.userRatingCount,places.currentOpeningHours,places.primaryTypeDisplayName,places.reviews,places.editorialSummary,places.location'
        },
        body: JSON.stringify({
          maxResultCount: parseInt(limit) || 10,
          includedTypes: ['tourist_attraction', 'restaurant', 'cafe', 'shopping_mall', 'park', 'museum', 'beach'],
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: parseFloat(radius) || 5000
            }
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // Log the actual Google error server-side but return a clean error to the client
      console.error('Google Places API error:', response.status, data);
      return res.status(200).json({ places: [], _error: `Google Places returned ${response.status}` });
    }

    const result = { places: data.places || [] };
    cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Places fetch error:', error);
    return res.status(200).json({ places: [], _error: error.message });
  }
}