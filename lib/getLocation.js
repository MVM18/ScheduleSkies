export const getLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        reject(error);
      }
    );
  });
};

// Fallback coords (Cebu City)
const DEFAULT_COORDS = { lat: 10.3167, lon: 123.8907 };

export const getLocationWithFallback = async () => {
  return getLocation().catch(() => DEFAULT_COORDS);
};

export const bboxFromPoint = (lat, lon, radiusKm = 5) => {
  const latDelta = radiusKm / 111.32;
  const lonDelta = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));

  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLon = lon - lonDelta;
  const maxLon = lon + lonDelta;

  return `${minLon},${minLat},${maxLon},${maxLat}`;
};

export const getBboxFromUserLocation = async (radiusKm = 5) => {
  const { lat, lon } = await getLocationWithFallback();
  return bboxFromPoint(lat, lon, radiusKm);
};