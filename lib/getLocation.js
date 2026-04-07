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