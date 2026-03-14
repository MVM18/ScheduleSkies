import React, { useState, useEffect } from 'react';
import styles from '../styles/event.module.css';

const MyEvents = () => {
  // 1. DATA STATE
  const [eventData, setEventData] = useState([
    {
      id: 1,
      title: "Breakfast-Zubuchon Bistro",
      location: "Parian, Cebu City",
      price: "₱350/Person",
      tags: [
        { label: "Food", styleClass: styles.foodGreen },
        { label: "Completed", styleClass: styles.completed },
        { label: "24°C • Cloudy", styleClass: styles.weatherBlue }
      ],
      typeColor: "#5EE093" 
    },
    {
      id: 2,
      title: "Lunch-Azani Restaurant",
      location: "Maria Luisa, Estate Park",
      price: "₱600/Person",
      tags: [
        { label: "Food", styleClass: styles.foodTan },
        { label: "Now", styleClass: styles.now },
        { label: "28°C • Partly Cloudy", styleClass: styles.weatherTan }
      ],
      typeColor: "#C57241" 
    },
    {
      id: 3,
      title: "Tops Lookout-Sunset View",
      location: "Busay, Cebu City",
      price: "₱350/Person",
      tags: [
        { label: "SightSeeing", styleClass: styles.sightseeing },
        { label: "Conflict", styleClass: styles.conflict },
        { label: "Overlaps travel from Anzani", styleClass: styles.overlaps }
      ],
      aiSuggestion: "AI Suggestion Adjust tot 3:30 PM to clear 28-min travel time",
      typeColor: "#FF0000" 
    },
    {
      id: 4,
      title: "Check-in — Radisson Hotel",
      location: "Serging Osmeña Blvd.",
      price: "₱4200/Night",
      tags: [
        { label: "Hotel", styleClass: styles.hotel },
        { label: "Leisure", styleClass: styles.leisure },
        { label: "30°C • Clear", styleClass: styles.weatherTeal }
      ],
      typeColor: "#5EE093" 
    }
  ]);

  // 2. UI & LOCATION STATE
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState('Locating...');
  const [currentDate, setCurrentDate] = useState('');

  const categories = ['All Events', 'Food', 'SightSeeing', 'Hotel', 'Leisure'];

  // 3. FETCH LOCATION & DATE
  useEffect(() => {
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    setCurrentDate(new Date().toLocaleDateString('en-US', options));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          setUserLocation(data.address.city || data.address.town || "Unknown Location");
        } catch (error) {
          setUserLocation("Cebu City"); 
        }
      });
    }
  }, []);

  // 4. FILTER & SEARCH LOGIC
  const filteredEvents = eventData.filter(event => {
    const matchesFilter = activeFilter === 'All Events' || 
      event.tags.some(tag => tag.label.toLowerCase().includes(activeFilter.toLowerCase()));
    
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      event.location.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  return (
    <div className={styles.appContainer}>
      <main className={styles.mainContent}>
        {/* Sky Decorations */}
        <div className={styles.sun}></div>
        <div className={`${styles.cloud} ${styles.cloud1}`}></div>
        <div className={`${styles.cloud} ${styles.cloud2}`}></div>

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
              <span className={styles.pill}>Day - 28°C</span>
              <span className={styles.pill}>{userLocation}</span>
              <span className={styles.pill}>{currentDate}</span>
            </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          {categories.map(cat => (
            <button 
              key={cat}
              className={`${styles.filterBtn} ${activeFilter === cat ? styles.activeFilter : ''}`}
              onClick={() => setActiveFilter(cat)}
            >
              {cat}
            </button>
          ))}
          
          {/* Action Group for Add/Edit Buttons */}
          <div className={styles.actionGroup}>
            <button 
              className={styles.actionBtn}
              onClick={() => alert("Add Button Clicked! Ready to build the modal.")}
            >
              <span style={{ fontSize: '16px', color: '#76b5d9' }}>⊕</span> Add
            </button>
            <button 
              className={styles.actionBtn}
              onClick={() => alert("Edit Button Clicked! Ready to add edit logic.")}
            >
              <span style={{ fontSize: '14px', color: '#76b5d9' }}>✎</span> Edit
            </button>
          </div>
        </div>

        {/* Event List */}
        <section className={styles.eventList}>
          {filteredEvents.map(event => (
            <div key={event.id} className={styles.eventCard}>
              <div className={styles.cardLeftBorder} style={{ backgroundColor: event.typeColor }}></div>
              <div className={styles.cardBody}>
                <div className={styles.eventInfo}>
                  <div className={styles.avatar}>XX</div>
                  <div className={styles.details}>
                    <h3>{event.title}</h3>
                    <p>{event.location} • {event.price}</p>
                    
                    <div className={styles.tagRow}>
                      {event.tags.map((tag, index) => (
                        <span key={index} className={`${styles.tag} ${tag.styleClass}`}>
                          {tag.label}
                        </span>
                      ))}
                    </div>

                    {event.aiSuggestion && (
                      <div className={styles.tagRow}>
                         <div className={styles.aiBox}>{event.aiSuggestion}</div>
                      </div>
                    )}
                  </div>
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