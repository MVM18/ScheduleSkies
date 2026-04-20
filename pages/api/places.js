const cache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

export default async function handler(req, res) {
  const { ll, radius, limit } = req.query;

  const cacheKey = `${ll}-${radius}-${limit}`;

  // Return cached result if fresh
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return res.status(200).json(cached.data);
  }

  const [lat, lng] = ll.split(',');

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.photos,places.types,places.userRatingCount'
        },
        body: JSON.stringify({
          maxResultCount: parseInt(limit) || 10,
          includedTypes: ['tourist_attraction', 'restaurant', 'cafe', 'shopping_mall', 'park', 'museum', 'beach'],
          locationRestriction: {
            circle: {
              center: {
                latitude: parseFloat(lat),
                longitude: parseFloat(lng)
              },
              radius: parseFloat(radius) || 5000
            }
          }
        })
      }
    );

    const data = await response.json();

    cache.set(cacheKey, { data, timestamp: Date.now() });

    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch places' });
  }
}