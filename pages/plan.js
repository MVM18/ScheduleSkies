import React from 'react';
import styles from '../styles/event.module.css';
import Sidebar from '@/components/Sidebar'

const MyEvents = () => {
  const events = [
    {
      id: 1,
      title: "Breakfast-Zubuchon Bistro",
      location: "Parian, Cebu City",
      price: "₱350/Person",
      time: "7:00 AM",
      duration: "1hr • Day 1",
      tags: ["Food"],
      status: "Completed",
      weather: "24°C • Cloudy",
      typeColor: "#4CAF50"
    },
    {
      id: 2,
      title: "Lunch-Azani Restaurant",
      location: "Maria Luisa, Estate Park",
      price: "₱600/Person",
      time: "12:00 PM",
      duration: "1.5hr • Day 1",
      tags: ["Food"],
      status: "Now",
      weather: "28°C • Partly Cloudy",
      typeColor: "#A1887F"
    },
    {
      id: 3,
      title: "Tops Lookout-Sunset View",
      location: "Busay, Cebu City",
      price: "₱350/Person",
      time: "3:00 PM",
      duration: "2hr • Day 1",
      tags: ["SightSeeing"],
      alert: "Conflict",
      alertDetail: "Overlaps travel from Anzani",
      aiSuggestion: "AI Suggestion: Adjust to 3:30 PM to clear 28-min travel time",
      typeColor: "#F44336"
    },
    {
      id: 4,
      title: "Check-in — Radisson Hotel",
      location: "Serging Osmeña Blvd.",
      price: "₱4200/Night",
      time: "7:00 PM",
      duration: "Overnight",
      tags: ["Hotel", "Leisure"],
      weather: "30°C • Clear",
      typeColor: "#4DB6AC"
    }
  ];

  return (
    <div className={styles.appContainer}>
      <Sidebar/>
      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Sky Background Effects */}
        <div className={styles.sun}></div>
        <div className={`${styles.cloud} ${styles.cloud1}`}></div>
        <div className={`${styles.cloud} ${styles.cloud2}`}></div>

        <header className={styles.header}>
          <div className={styles.titleGlass}>
            <h1>My Events</h1>
          </div>

          <div className={styles.searchSection}>
            <div className={styles.searchBar}>
              <input type="text" placeholder="Search..." />
              <span className={styles.searchIcon}>🔍</span>
            </div>
            <div className={styles.infoPills}>
              <span className={styles.pill}>Night - 24°C</span>
              <span className={styles.pill}>Cebu City</span>
              <span className={styles.pill}>March 3-7, 2026</span>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          <button className={`${styles.filterBtn} ${styles.activeFilter}`}>All Events</button>
          <button className={styles.filterBtn}>Food</button>
          <button className={styles.filterBtn}>SightSeeing</button>
          <button className={styles.filterBtn}>Hotel</button>
          <button className={styles.filterBtn}>Leisure</button>
          <div className={styles.actionGroup}>
            <button className={styles.addBtn}>Add</button>
            <button className={styles.editBtn}>Edit</button>
          </div>
        </div>

        {/* Event List */}
        <section className={styles.eventList}>
          {events.map(event => (
            <div key={event.id} className={styles.eventCard}>
              <div className={styles.cardLeftBorder} style={{ backgroundColor: event.typeColor }}></div>
              <div className={styles.cardBody}>
                <div className={styles.eventInfo}>
                  <div className={styles.avatar}>TEMP</div>
                  <div className={styles.details}>
                    <h3>{event.title}</h3>
                    <p>{event.location} • {event.price}</p>
                    <div className={styles.tagRow}>
                      {event.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                      {event.status && <span className={`${styles.tag} ${styles.statusTag}`}>{event.status}</span>}
                      {event.weather && <span className={`${styles.tag} ${styles.weatherTag}`}>{event.weather}</span>}
                      {event.alert && <span className={`${styles.tag} ${styles.alertTag}`}>{event.alert}</span>}
                      {event.alertDetail && <span className={`${styles.tag} ${styles.alertDetailTag}`}>{event.alertDetail}</span>}
                    </div>
                    {event.aiSuggestion && (
                        <div className={styles.aiBox}>{event.aiSuggestion}</div>
                    )}
                  </div>
                </div>
                <div className={styles.eventTime}>
                  <h2 style={{color: event.alert ? '#F44336' : event.status === 'Now' ? '#A1887F' : '#333'}}>{event.time}</h2>
                  <p>{event.duration}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default MyEvents;