import React from 'react';
import styles from '@/styles/event.module.css';

const EventsHeader = ({ searchQuery, setSearchQuery, temperature, userLocation, currentDate }) => {
  return (
    <header className={styles.header}>
      <div className={styles.titleGlass}>
        <h1>My Events</h1>
      </div>

      <div className={styles.searchSection}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search events or locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className={styles.searchIcon}>🔍</span>
        </div>
        <div className={styles.infoPills}>
          <span className={styles.pill}>Day - {temperature}°C</span>
          <span className={styles.pill}>{userLocation}</span>
          <span className={styles.pill}>{currentDate}</span>
        </div>
      </div>
    </header>
  );
};

export default EventsHeader;