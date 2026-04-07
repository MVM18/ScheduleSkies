import React, { useEffect, useState } from 'react'
import styles from '../styles/weather.module.css'
import { getLocationWithFallback } from "@/lib/getLocation";

export default function WeatherOverview({ username = 'User', weather = {} }) {
  const date = new Date()
  const options = { month: 'long', day: 'numeric', weekday: 'long' }
  const formattedDate = date.toLocaleDateString(undefined, options)

  const [weatherData, setWeatherData] = useState(false);

  const getWeatherData = async ()=>{
    const { lat, lon } = await getLocationWithFallback();

    try{
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();
      console.log(data);
      setWeatherData({
        location: data.name,
        temperature: Math.floor(data.main.temp),
        feelsLike: Math.floor(data.main.feels_like),
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        precipitation: data.rain?.["1h"] ?? data.snow?.["1h"] ?? 0
      })
    }
    catch(error){
      console.error("Weather fetch failed:", error);
    }
  }

  
  useEffect(()=>{
    getWeatherData();
  },[])

  return (
    <div className={styles.overview}>
      <h1 className={styles.greeting}>Welcome Back, {username}</h1>
      <div className={styles.temperatureContainer}>
        <p className={styles.location_and_date}>{weatherData.location}</p>
        <p className={styles.location_and_date}>{formattedDate}</p>
        <div className={styles.temperature}>{weatherData.temperature}°C</div>
        <p className={styles.feels}>Feels like {weatherData.feelsLike}°C</p>
      </div>
      <div className={styles.metrics}>
        <div className={styles.metricsContainer}>Humidity: {weatherData.humidity}%</div>
        <div className={styles.metricsContainer}>Precipitation: {weatherData.precipitation} mm</div>
        <div className={styles.metricsContainer}>Wind: {weatherData.windSpeed} km/h</div>
      </div>
    </div>
  )
}
