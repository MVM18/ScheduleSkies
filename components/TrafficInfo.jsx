import React, { useEffect, useState } from 'react'
import styles from '../styles/traffic.module.css'
import { FaExclamationCircle } from 'react-icons/fa'
import { getBboxFromUserLocation } from '@/lib/getLocation'

const locationCache = new Map();

export default function TrafficInfo() {
  // incidents: [{level:'heavy'|'moderate',location:''},...]
  const iconMap = {
    1: "🚗",
    2: "🌫️",
    3: "⚠️",
    4: "🌧️",
    5: "🧊",
    6: "🚦",
    7: "🚧",
    8: "⛔",
    9: "🚧",
    10: "💨",
    11: "🌊",
    14: "🚙",
  };

  const [incidentData, setIncidentData] = useState([]);

  async function loadIncidents() {
    const bbox = await getBboxFromUserLocation(5); // 5 km radius

    const fields = encodeURIComponent("{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},startTime,endTime,from,to}}}");

    const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${process.env.NEXT_PUBLIC_TRAFFIC_API_KEY}&bbox=${bbox}&fields=${fields}&language=en-GB&timeValidityFilter=present`;

    const response = await fetch(url);
    const data = await response.json();
    console.log(data.incidents);
    const incidentArray = await transformIncidents(data);
    console.log(incidentArray);
    setIncidentData(incidentArray);
  }

  async function transformIncidents(data) {
    const incidents = data?.incidents || [];

    return Promise.all(
      incidents.map(async (inc) => {
        const p = inc.properties || {};
        const event = p.events?.[0] || {};

        let location = p.from || p.to || null;

        // fallback to reverse geocode if missing
        if (!location && inc.geometry?.coordinates) {
          const [lon, lat] = inc.geometry.coordinates;
          location = await getLocationName(lat, lon);
        }

        return {
          id: p.id,
          title: event.description || "Traffic incident",
          location,
          iconCategory: p.iconCategory,
          delayLevel: p.magnitudeOfDelay ?? 0,
          startTime: p.startTime ? new Date(p.startTime) : null,
          endTime: p.endTime ? new Date(p.endTime) : null,
          from: p.from,
          to: p.to
        };
      })
    );
  }

  async function getLocationName(lat, lon) {
    const key = `${lat},${lon}`;

    if (locationCache.has(key)) {
      return locationCache.get(key);
    }

    const url = `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?key=${process.env.NEXT_PUBLIC_TRAFFIC_API_KEY}`;

    try {
      const res = await fetch(url);
      const data = await res.json();

      const name =
        data?.addresses?.[0]?.address?.freeformAddress || "Unknown location";

      locationCache.set(key, name);
      return name;
    } catch {
      return "Unknown location";
    }
  }

  useEffect(()=>{
    loadIncidents();
  },[])

  return (
    <div className={styles.container}>
      <p className={styles.title}>TRAFFIC INFO</p>
      <div className={styles.traffic_container}>
        {incidentData.map((inc, idx) => (
          <div key={inc.id} className={
            inc.delayLevel > 2 ? styles.heavy : styles.moderate
          }>
            <div className={styles.icon}>
              <span>{iconMap[inc.iconCategory] || "⚠️"}</span>
            </div>

            <div>
              <p className={styles.text}>
                {inc.title || inc.from}
              </p>
              <p className={styles.location}>
                {inc.from && inc.to
                  ? `${inc.from} - ${inc.to}`
                  : "blank"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
