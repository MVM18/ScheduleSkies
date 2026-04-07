import React, { useState, useEffect } from 'react';
import styles from '../styles/event.module.css';
import Sidebar from '@/components/Sidebar'; 

const MyEvents = () => {
  // --- 1. DATA STATE ---
  const [eventData, setEventData] = useState([
    {
      id: 1,
      title: "Breakfast-Zubuchon Bistro",
      location: "Parian, Cebu City",
      price: "₱350/Person",
      date: "2026-03-07",
      category: "Food",
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
      date: "2026-03-07",
      category: "Food",
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
      date: "2026-03-08",
      category: "SightSeeing",
      tags: [
        { label: "SightSeeing", styleClass: styles.sightseeing },
        { label: "Conflict", styleClass: styles.conflict }
      ],
      aiSuggestion: "AI Suggestion: Adjust to 3:30 PM to clear 28-min travel time",
      typeColor: "#FF0000" 
    },
    {
      id: 4,
      title: "Check-in — Radisson Hotel",
      location: "Serging Osmeña Blvd.",
      price: "₱4200/Night",
      date: "2026-03-09",
      category: "Hotel",
      tags: [
        { label: "Hotel", styleClass: styles.hotel },
        { label: "Leisure", styleClass: styles.leisure },
        { label: "30°C • Clear", styleClass: styles.weatherTeal }
      ],
      typeColor: "#5EE093" 
    }
  ]);

  // --- 2. UI & LOCATION STATE ---
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState('Locating...');
  const [currentDate, setCurrentDate] = useState('');
  
  // Modal & Form States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isEditListMode, setIsEditListMode] = useState(false); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const initialFormState = { title: '', location: '', price: '', date: '', category: 'Food' };
  const [formData, setFormData] = useState(initialFormState);

  const categories = ['All Events', 'Food', 'SightSeeing', 'Hotel', 'Leisure'];
  const formCategories = ['Food', 'SightSeeing', 'Hotel', 'Leisure']; 

  // --- 3. FETCH LOCATION & DATE ---
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

  // --- 4. FORM & EVENT LOGIC ---
  const getCategoryTheme = (category) => {
    switch(category) {
      case 'SightSeeing': return { color: '#6D7DB9', styleClass: styles.sightseeing };
      case 'Hotel': return { color: '#4A9FBB', styleClass: styles.hotel };
      case 'Leisure': return { color: '#21B694', styleClass: styles.leisure };
      case 'Food': 
      default: return { color: '#5EE093', styleClass: styles.foodGreen };
    }
  };

  const handleOpenAddForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (event) => {
    setFormData({
      title: event.title,
      location: event.location,
      price: event.price,
      date: event.date,
      category: event.category || 'Food'
    });
    setEditingId(event.id);
    setIsFormOpen(true);
  };

  const handleDeleteEvent = (id) => {
    if(window.confirm("Are you sure you want to delete this event?")) {
      setEventData(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleSaveEvent = (e) => {
    e.preventDefault();
    const theme = getCategoryTheme(formData.category);
    
    const newEventData = {
      id: editingId || Date.now(),
      title: formData.title,
      location: formData.location,
      price: formData.price,
      date: formData.date,
      category: formData.category,
      typeColor: theme.color,
      tags: [{ label: formData.category, styleClass: theme.styleClass }]
    };

    if (editingId) {
      setEventData(prev => prev.map(ev => ev.id === editingId ? { ...ev, ...newEventData } : ev));
    } else {
      setEventData(prev => [...prev, newEventData]);
      setActiveFilter('All Events'); 
    }
    
    setIsFormOpen(false);
  };

  // --- 5. FILTER & SEARCH ---
  const filteredEvents = eventData.filter(event => {
    const matchesFilter = activeFilter === 'All Events' || 
      event.tags.some(tag => tag.label.toLowerCase().includes(activeFilter.toLowerCase()));
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // --- 6. CALENDAR GENERATION ---
  const currentYear = 2026;
  const currentMonth = 2; // March
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const blanks = Array(firstDayOfMonth).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className={styles.appContainer}>
       <Sidebar />
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
          
          {/* Action Group */}
          <div className={styles.actionGroup}>
            <button className={styles.actionBtn} onClick={() => setIsCalendarOpen(true)}>
              <span style={{ fontSize: '14px', color: '#76b5d9' }}>📅</span> Calendar
            </button>
            <button className={styles.actionBtn} onClick={handleOpenAddForm}>
              <span style={{ fontSize: '16px', color: '#76b5d9' }}>⊕</span> Add
            </button>
            <button 
              className={`${styles.actionBtn} ${isEditListMode ? styles.activeEditBtn : ''}`}
              onClick={() => setIsEditListMode(!isEditListMode)}
            >
              <span style={{ fontSize: '14px', color: '#76b5d9' }}>✎</span> {isEditListMode ? 'Done' : 'Edit'}
            </button>
          </div>
        </div>

        {/* Event List */}
        <section className={styles.eventList}>
          {filteredEvents.length === 0 ? (
            <div className={styles.emptyState}>No events found. Click "Add" to create one!</div>
          ) : (
            filteredEvents.map(event => (
              <div key={event.id} className={styles.eventCard}>
                <div className={styles.cardLeftBorder} style={{ backgroundColor: event.typeColor }}></div>
                <div className={styles.cardBody}>
                  <div className={styles.eventInfo}>
                    <div className={styles.avatar}>
                      {event.title.substring(0,2).toUpperCase()}
                    </div>
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
                
                {/* Conditionally Render Edit/Delete Actions */}
                {isEditListMode && (
                  <div className={styles.cardActions}>
                    <button onClick={() => handleOpenEditForm(event)} className={styles.iconBtnEdit}>✎</button>
                    <button onClick={() => handleDeleteEvent(event.id)} className={styles.iconBtnDelete}>🗑</button>
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </main>

      {/* --- ADD / EDIT EVENT MODAL --- */}
      {isFormOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsFormOpen(false)}>
          <div className={styles.formModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.formHeader}>
              <h2>{editingId ? 'Edit Event' : 'Create New Event'}</h2>
              <button className={styles.closeBtnLight} onClick={() => setIsFormOpen(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSaveEvent} className={styles.eventForm}>
              <div className={styles.formGroup}>
                <label>Event Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Lunch at Azani" />
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Location</label>
                  <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="City, Area" />
                </div>
                <div className={styles.formGroup}>
                  <label>Price / Cost</label>
                  <input required type="text" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} placeholder="e.g. ₱350/Person" />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Date</label>
                  <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                </div>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    {formCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              <div className={styles.formFooter}>
                <button type="button" className={styles.btnCancel} onClick={() => setIsFormOpen(false)}>Cancel</button>
                <button type="submit" className={styles.btnSave}>{editingId ? 'Save Changes' : 'Create Event'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- CALENDAR MODAL OVERLAY --- */}
      {isCalendarOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCalendarOpen(false)}>
          <div className={styles.calendarModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.calHeader}>
              <div className={styles.calHeaderLeft}>
                <button className={styles.calTodayBtn}>Today</button>
                <div className={styles.calArrows}>
                  <span>&lt;</span>
                  <span>&gt;</span>
                </div>
                <h2>March 2026</h2>
              </div>
              <div className={styles.calHeaderRight}>
                <button className={styles.calCloseBtn} onClick={() => setIsCalendarOpen(false)}>✕</button>
              </div>
            </div>
            <div className={styles.calWeekdays}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className={styles.calGrid}>
              {blanks.map((_, i) => <div key={`blank-${i}`} className={styles.calCellEmpty}></div>)}
              {days.map(day => {
                const dateStr = `${currentYear}-0${currentMonth + 1}-0${day}`.replace('-00', '-0').replace('-010','-10').replace('-011','-11').replace('-012','-12').replace('-013','-13').replace('-014','-14').replace('-015','-15').replace('-016','-16').replace('-017','-17').replace('-018','-18').replace('-019','-19').replace('-020','-20').replace('-021','-21').replace('-022','-22').replace('-023','-23').replace('-024','-24').replace('-025','-25').replace('-026','-26').replace('-027','-27').replace('-028','-28').replace('-029','-29').replace('-030','-30').replace('-031','-31');
                const dayEvents = eventData.filter(e => e.date === dateStr);
                return (
                  <div key={day} className={styles.calCell}>
                    <span className={styles.calDayNum}>{day}</span>
                    <div className={styles.calEventsContainer}>
                      {dayEvents.map(ev => (
                        <div key={ev.id} className={styles.calEventPill} style={{ backgroundColor: ev.typeColor }}>
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyEvents;