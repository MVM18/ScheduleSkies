import React, { useEffect, useState } from 'react'
import styles from '../styles/weather.module.css'
import { getLocationWithFallback } from '@/lib/getLocation'

export default function WeatherOverview({ username = 'User', weather = {} }) {
  const date = new Date();
  const options = { month: 'long', day: 'numeric', weekday: 'long' };
  const formattedDate = date.toLocaleDateString(undefined, options);
  const [loading, setLoading] = useState(true);

  const [weatherData, setWeatherData] = useState({
    location: 'Cebu City',
    temperature: weather.temperature ?? '--',
    feelsLike: weather.feelsLike ?? '--',
    humidity: weather.humidity ?? '--',
    windSpeed: weather.wind ?? '--',
    precipitation: weather.precipitation ?? 0
  });

  const CACHE_TTL = 1000 * 60 * 15; // 15 minutes
  const CACHE_KEY = 'weather_cache';

  const getWeatherData = async () => {
    const { lat, lon } = await getLocationWithFallback();

    // Check cache first
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        setWeatherData(cached.data);
        setLoading(false);
        return;
      }
    } catch (_) {}

    try {
      setLoading(true);
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || !data?.main) {
        throw new Error(data?.message || 'Weather API returned invalid response');
      }

      const weatherData = {
        location: data.name || 'Cebu City',
        temperature: Math.floor(data.main.temp),
        feelsLike: Math.floor(data.main.feels_like),
        humidity: data.main.humidity,
        windSpeed: data.wind?.speed ?? 0,
        precipitation: data.rain?.["1h"] ?? data.snow?.["1h"] ?? 0
      };

      // Save to cache
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        data: weatherData,
        timestamp: Date.now()
      }));

      setWeatherData(weatherData);
    } catch (error) {
      console.error("Weather fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    getWeatherData();
  },[])


  return (
    <div className={styles.overview}>
      <h1 className={styles.greeting}>Welcome Back, {username}</h1>
      <div className={styles.temperatureContainer}>
        {loading ? (
          <div className="spinner-container">
            <div className="loading-spinner"></div>
          </div>
        ) : (
          <>
            <p className={styles.location_and_date}>{weatherData.location}</p>
            <p className={styles.location_and_date}>{formattedDate}</p>
            <div className={styles.temperature}>{weatherData.temperature}°C</div>
            <p className={styles.feels}>Feels like {weatherData.feelsLike}°C</p>
          </>
        )}
      </div>
      <div className={styles.metrics}>
        {loading ? (
          <div className="spinner-container">
            <div className="loading-spinner"></div>
          </div>
        ) : (
        <>
          <div className={styles.metricsContainer}>Humidity: {weatherData.humidity}%</div>
          <div className={styles.metricsContainer}>Precipitation: {weatherData.precipitation} mm</div>
          <div className={styles.metricsContainer}>Wind: {weatherData.windSpeed} km/h</div>
        </>
        )}
      </div>
    </div>
  )
}
