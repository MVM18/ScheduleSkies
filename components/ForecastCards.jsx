import React from 'react'
import styles from '../styles/forecast.module.css'
import { useEffect, useState } from 'react'
import { getLocationWithFallback } from "@/lib/getLocation";

export default function ForecastCards({}) {
  const [forecastData, setForecastData] = useState([]);
  
  const getForecastData = async ()=>{
    
    const { lat, lon } = await getLocationWithFallback(); 

    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok || !Array.isArray(data?.list)) {
        throw new Error(data?.message || 'Forecast API returned invalid response');
      }

      const forecastArray = data.list.slice(0, 4).map(item => {
        const localTime = new Date((item?.dt ?? Date.now() / 1000) * 1000).toLocaleTimeString('en-PH', {
          timeZone: 'Asia/Manila',
          hour: 'numeric',
          hour12: true
        });

        return {
          time: localTime,
          temp: Math.floor(item?.main?.temp ?? 0),
          iconUrl: item?.weather?.[0]?.icon
            ? `https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png`
            : '',
          description: item?.weather?.[0]?.description || 'No data',
        };
      });

      setForecastData(forecastArray);
    } catch (error) {
      console.error('Forecast fetch failed:', error);
      setForecastData([]);
    }
  }

  useEffect(()=>{
      getForecastData();
    },[])

  return (
    <div className={styles.container}>
      <p>TODAY'S FORECAST</p>
      <div className={styles.cardContainer}>
        {forecastData.map((h, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.time}>{h.time}</div>
            <div className={styles.icon}>
              {h.iconUrl && <img src={h.iconUrl} alt="weather icon" />}
            </div>
            <div className={styles.temp}>{h.temp}°C</div>
          </div>
        ))}
      </div>
    </div>
  )
}
