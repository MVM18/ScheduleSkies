import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { getLocationWithFallback } from "@/lib/getLocation";
import { buildWeatherContext, detectScheduleConflicts } from '@/lib/aiContext';
import styles from '../styles/event.module.css';
import Sidebar from '@/components/Sidebar';

const MyEvents = () => {
  // --- 1. DATA STATE ---
  const [eventData, setEventData] = useState([]);
  const [userId, setUserId] = useState(null);
  const router = useRouter();

  const generateDynamicProps = (event) => {
    let styleClass = styles.foodGreen;
    let typeColor = '#5EE093';
    if (event.category === 'SightSeeing') { styleClass = styles.sightseeing; typeColor = '#6D7DB9'; }
    if (event.category === 'Hotel') { styleClass = styles.hotel; typeColor = '#4A9FBB'; }
    if (event.category === 'Leisure') { styleClass = styles.leisure; typeColor = '#21B694'; }

    return {
      ...event,
      typeColor,
      tags: [
        { label: event.category, styleClass: styleClass }
      ]
    };
  };

  const fetchEvents = async () => {
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data && !error) {
      setEventData(data.map(generateDynamicProps));
    }
  };

  // --- 2. UI & LOCATION STATE ---
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState('Locating...');
  const [currentDate, setCurrentDate] = useState('');
  const [temperature, setTemperature] = useState('--');

  // Modal & Form States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [isEditListMode, setIsEditListMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Itinerary States
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const [selectedEventForItinerary, setSelectedEventForItinerary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const initialActivityForm = { activity_name: '', description: '', start_time: '', end_time: '', location: '' };
  const [activityForm, setActivityForm] = useState(initialActivityForm);

  const initialFormState = { title: '', location: '', price: '', date: '', category: 'Food', venue: '', start_datetime: '', end_datetime: '', latitude: null, longitude: null };
  const [formData, setFormData] = useState(initialFormState);

  // AI Suggestions State
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  const categories = ['All Events', 'Food', 'SightSeeing', 'Hotel', 'Leisure'];
  const formCategories = ['Food', 'SightSeeing', 'Hotel', 'Leisure'];

  // --- 3. FETCH LOCATION & DATE & AUTH ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
      } else {
        setUserId(session.user.id);
        fetchEvents();
      }
    };
    checkUser();

    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    setCurrentDate(new Date().toLocaleDateString('en-US', options));

    const fetchWeather = async () => {
      const { lat, lon } = await getLocationWithFallback();
      try {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        if (data && data.main) {
          setTemperature(Math.floor(data.main.temp));
          setUserLocation(data.name || "Cebu City");
        }
      } catch (err) {
        console.error("Weather fetch failed:", err);
      }
    };
    fetchWeather();
  }, []);

  // --- AI ANALYSIS ---
  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setShowAiPanel(true);
    setAiSuggestions([]);

    try {
      // Detect conflicts locally
      const conflicts = detectScheduleConflicts(eventData);

      // Get weather context
      const { lat, lon } = await getLocationWithFallback();
      const weatherCtx = await buildWeatherContext(lat, lon);

      // Call AI endpoint
      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze my itinerary. Check for conflicts, suggest weather-based adjustments, and recommend improvements. Be specific about each event.',
          context: {
            events: eventData.map(e => ({ title: e.title, location: e.location, date: e.date, category: e.category, price: e.price })),
            weather: weatherCtx,
            location: userLocation,
            conflicts,
            currentWeather: { temp: temperature, description: 'Current', city: userLocation },
          },
        }),
      });

      const data = await response.json();

      const newSuggestions = [];

      // Add conflict suggestions
      if (conflicts.length > 0) {
        conflicts.forEach(c => {
          newSuggestions.push({
            type: c.severity === 'warning' ? 'warning' : 'info',
            icon: c.severity === 'warning' ? '⚠️' : 'ℹ️',
            title: c.type === 'overloaded' ? 'Busy Day Alert' : c.type === 'duplicate_location' ? 'Duplicate Location' : 'Travel Time Check',
            message: c.message,
          });
        });
      }

      // Add AI analysis
      if (data.reply) {
        newSuggestions.push({
          type: 'ai',
          icon: '✨',
          title: 'AI Itinerary Analysis',
          message: data.reply,
        });
      }

      if (newSuggestions.length === 0) {
        newSuggestions.push({
          type: 'success',
          icon: '✅',
          title: 'All Good!',
          message: 'No issues detected. Your schedule looks well-organized!',
        });
      }

      setAiSuggestions(newSuggestions);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiSuggestions([{
        type: 'warning',
        icon: '⚠️',
        title: 'Analysis Unavailable',
        message: 'Could not complete the analysis. Please try again.',
      }]);
    }

    setIsAiLoading(false);
  };

  const dismissSuggestion = (index) => {
    setAiSuggestions(prev => prev.filter((_, i) => i !== index));
    if (aiSuggestions.length <= 1) setShowAiPanel(false);
  };

  // --- 4. FORM & EVENT LOGIC ---
  const handleOpenAddForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
    setIsFormOpen(true);
    setLocationResults([]);
  };

  const handleOpenEditForm = (event) => {
    setFormData({
      title: event.title,
      location: event.location,
      price: event.price,
      date: event.date,
      category: event.category || 'Food',
      venue: event.venue || '',
      start_datetime: event.start_datetime ? event.start_datetime.slice(0, 16) : '',
      end_datetime: event.end_datetime ? event.end_datetime.slice(0, 16) : '',
      latitude: event.latitude || null,
      longitude: event.longitude || null
    });
    setEditingId(event.id);
    setIsFormOpen(true);
    setLocationResults([]);
  };

  const handleDeleteEvent = async (id) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      await supabase.from('events').delete().eq('id', id);
      setEventData(prev => prev.filter(e => e.id !== id));
    }
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!userId) return;

    const newEventData = {
      title: formData.title,
      location: formData.location,
      price: formData.price,
      date: formData.date || (formData.start_datetime ? formData.start_datetime.split('T')[0] : null),
      category: formData.category,
      user_id: userId,
      venue: formData.venue || null,
      start_datetime: formData.start_datetime || null,
      end_datetime: formData.end_datetime || null,
      latitude: formData.latitude || null,
      longitude: formData.longitude || null
    };

    if (editingId) {
      const { data, error } = await supabase.from('events').update(newEventData).eq('id', editingId).select();
      if (data && !error) {
        setEventData(prev => prev.map(ev => ev.id === editingId ? generateDynamicProps(data[0]) : ev));
      }
    } else {
      const { data, error } = await supabase.from('events').insert([newEventData]).select();
      if (data && !error) {
        setEventData(prev => [...prev, generateDynamicProps(data[0])]);
        setActiveFilter('All Events');
      }
    }

    setIsFormOpen(false);
  };

  const handleLocationSearch = async (val) => {
    setFormData({ ...formData, location: val, latitude: null, longitude: null });
    if (val.length > 2) {
      setIsSearchingLocation(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`);
        const data = await res.json();
        setLocationResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingLocation(false);
      }
    } else {
      setLocationResults([]);
    }
  };

  const handleSelectLocation = (loc) => {
    setFormData({
      ...formData,
      location: loc.display_name,
      latitude: parseFloat(loc.lat),
      longitude: parseFloat(loc.lon)
    });
    setLocationResults([]);
  };

  // --- 5. ITINERARY LOGIC ---
  const handleOpenItinerary = async (event) => {
    setSelectedEventForItinerary(event);
    setIsItineraryOpen(true);
    setIsActivityFormOpen(false);
    setEditingActivityId(null);
    setActivityForm(initialActivityForm);
    await fetchActivities(event.id);
  };

  const fetchActivities = async (eventId) => {
    const { data, error } = await supabase
      .from('itinerary_activities')
      .select('*')
      .eq('event_id', eventId)
      .order('start_time', { ascending: true });
    if (data && !error) {
      setActivities(data);
    }
  };

  const handleOpenActivityForm = (activity = null) => {
    if (activity) {
      setActivityForm({
        activity_name: activity.activity_name,
        description: activity.description || '',
        start_time: activity.start_time ? activity.start_time.slice(0, 16) : '',
        end_time: activity.end_time ? activity.end_time.slice(0, 16) : '',
        location: activity.location || ''
      });
      setEditingActivityId(activity.id);
    } else {
      setActivityForm(initialActivityForm);
      setEditingActivityId(null);
    }
    setIsActivityFormOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!userId || !selectedEventForItinerary) return;

    const activityData = {
      event_id: selectedEventForItinerary.id,
      user_id: userId,
      activity_name: activityForm.activity_name,
      description: activityForm.description || null,
      start_time: activityForm.start_time,
      end_time: activityForm.end_time,
      location: activityForm.location || null,
      sort_order: activities.length
    };

    if (editingActivityId) {
      const { data, error } = await supabase
        .from('itinerary_activities')
        .update(activityData)
        .eq('id', editingActivityId)
        .select();
      if (data && !error) {
        setActivities(prev => prev.map(a => a.id === editingActivityId ? data[0] : a));
      }
    } else {
      const { data, error } = await supabase
        .from('itinerary_activities')
        .insert([activityData])
        .select();
      if (data && !error) {
        setActivities(prev => [...prev, data[0]]);
      }
    }

    setIsActivityFormOpen(false);
    setEditingActivityId(null);
    setActivityForm(initialActivityForm);
  };

  const handleDeleteActivity = async (id) => {
    if (window.confirm("Delete this activity?")) {
      await supabase.from('itinerary_activities').delete().eq('id', id);
      setActivities(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleNavigateToVenue = (event) => {
    if (event.latitude && event.longitude) {
      router.push(`/map?lat=${event.latitude}&lng=${event.longitude}&label=${encodeURIComponent(event.venue || event.location)}`);
    } else {
      router.push(`/map`);
    }
  };

  // --- 6. FILTER & SEARCH ---
  const filteredEvents = eventData.filter(event => {
    const matchesFilter = activeFilter === 'All Events' ||
      event.tags.some(tag => tag.label.toLowerCase().includes(activeFilter.toLowerCase()));
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // --- 7. CALENDAR GENERATION ---
  const currentYear = calendarDate.getFullYear();
  const currentMonth = calendarDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const blanks = Array(firstDayOfMonth).fill(null);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => setCalendarDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCalendarDate(new Date(currentYear, currentMonth + 1, 1));
  const handleToday = () => setCalendarDate(new Date());

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // --- HELPERS ---
  const formatDateTime = (dtStr) => {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatTime = (dtStr) => {
    if (!dtStr) return '';
    const d = new Date(dtStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateRange = (start, end) => {
    if (!start) return '';
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    const dateStr = s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const startTime = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const endTime = e ? e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
    return { dateStr, startTime, endTime };
  };

  return (
    <div className={styles.appContainer}>

      {/* This wrapper guarantees the Sidebar (and its mobile downbar) 
        sits entirely on top of the main content 
      */}
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <Sidebar />
      </div>

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
              <span className={styles.pill}>Day - {temperature}°C</span>
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

          {/* Action Group (Desktop Only) */}
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
            <button
              className={styles.actionBtn}
              onClick={handleAiAnalysis}
              disabled={isAiLoading}
              style={{ background: isAiLoading ? 'rgba(102, 126, 234, 0.15)' : undefined }}
            >
              <span style={{ fontSize: '14px' }}>{isAiLoading ? '⏳' : '✨'}</span> {isAiLoading ? 'Analyzing...' : 'AI Suggest'}
            </button>
          </div>
        </div>

        {/* Event List */}
        {/* AI Suggestions Panel */}
        {showAiPanel && aiSuggestions.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', color: '#1a365d', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                ✨ AI Suggestions
              </h3>
              <button
                onClick={() => { setShowAiPanel(false); setAiSuggestions([]); }}
                style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}
              >✕</button>
            </div>
            {aiSuggestions.map((s, i) => (
              <div key={i} style={{
                background: s.type === 'warning' ? 'rgba(237, 137, 54, 0.08)' : s.type === 'success' ? 'rgba(72, 187, 120, 0.08)' : 'rgba(102, 126, 234, 0.08)',
                border: `1px solid ${s.type === 'warning' ? 'rgba(237, 137, 54, 0.25)' : s.type === 'success' ? 'rgba(72, 187, 120, 0.25)' : 'rgba(102, 126, 234, 0.2)'}`,
                borderRadius: '12px',
                padding: '12px 14px',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px' }}>{s.icon}</span>
                  <strong style={{ fontSize: '13px', color: '#2d3748' }}>{s.title}</strong>
                  <button
                    onClick={() => dismissSuggestion(i)}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}
                  >✕</button>
                </div>
                <div style={{ fontSize: '12.5px', color: '#4a5568', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {s.message}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* AI Loading Indicator */}
        {isAiLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
            padding: '16px', marginBottom: '12px',
            background: 'rgba(102, 126, 234, 0.06)', borderRadius: '12px',
            border: '1px solid rgba(102, 126, 234, 0.15)',
          }}>
            <span style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>✨</span>
            <span style={{ fontSize: '13px', color: '#5a67d8', fontWeight: 600 }}>Analyzing your itinerary...</span>
          </div>
        )}

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
                      {event.title.substring(0, 2).toUpperCase()}
                    </div>
                    <div className={styles.details}>
                      <h3>{event.title}</h3>
                      <p>{event.location} • {event.price}</p>

                      {/* Enhanced meta info */}
                      <div className={styles.eventMeta}>
                        {event.venue && <span>🏛️ {event.venue}</span>}
                        {event.start_datetime ? (
                          <span>📅 {formatDateTime(event.start_datetime)}</span>
                        ) : event.date ? (
                          <span>📅 {event.date}</span>
                        ) : null}
                        {event.end_datetime && <span>→ {formatTime(event.end_datetime)}</span>}
                      </div>

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

                      {/* Itinerary & Navigate Buttons */}
                      <div className={styles.cardBtnRow}>
                        <button
                          className={styles.itineraryBtn}
                          onClick={() => handleOpenItinerary(event)}
                        >
                          📋 Itinerary
                        </button>
                        {(event.latitude && event.longitude) && (
                          <button
                            className={styles.navigateBtn}
                            onClick={() => handleNavigateToVenue(event)}
                          >
                            🧭 Navigate
                          </button>
                        )}
                      </div>
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
      </main> {/* THIS IS WHERE THE MAIN TAG MUST CLOSE */}

      {/* --- MOBILE FLOATING ACTION PILL (Now completely outside of main content) --- */}
      {/*<div className={styles.mobileFloatingActions}>
        {/* Edit Button */}
      {/*<button 
          className={`${styles.mobileActionBtn} ${isEditListMode ? styles.activeEdit : ''}`}
          onClick={() => setIsEditListMode(!isEditListMode)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>*/}

      {/* Add Button */}
      {/* <button className={styles.mobileActionBtn} onClick={handleOpenAddForm}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="12" y1="8" x2="12" y2="16"></line>
            <line x1="8" y1="12" x2="16" y2="12"></line>
          </svg>
        </button>

        {/* Calendar Button */}
      {/*<button className={styles.mobileActionBtn} onClick={() => setIsCalendarOpen(true)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
            <path d="M9 16l2 2 4-4"></path>
          </svg>
        </button>
      </div>

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
                <input required type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="e.g. Lunch at Azani" />
              </div>

              <div className={styles.formGroup}>
                <label>Venue</label>
                <input type="text" value={formData.venue} onChange={e => setFormData({ ...formData, venue: e.target.value })} placeholder="e.g. Timmy Stevens Center" />
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ position: 'relative' }}>
                  <label>Location / Address</label>
                  <input required type="text" value={formData.location} onChange={e => handleLocationSearch(e.target.value)} placeholder="City, Area" />
                  {locationResults.length > 0 && (
                    <div className={styles.autocompleteDropdown} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ddd', zIndex: 10, maxHeight: '150px', overflowY: 'auto', borderRadius: '4px' }}>
                      {locationResults.map((loc, i) => (
                        <div key={i} onClick={() => handleSelectLocation(loc)} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee', color: 'black', fontSize: '12px' }}>
                          {loc.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label>Price / Cost</label>
                  <input required type="text" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="e.g. ₱350/Person" />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Start Date & Time</label>
                  <input type="datetime-local" value={formData.start_datetime} onChange={e => setFormData({ ...formData, start_datetime: e.target.value, date: e.target.value ? e.target.value.split('T')[0] : formData.date })} />
                </div>
                <div className={styles.formGroup}>
                  <label>End Date & Time</label>
                  <input type="datetime-local" value={formData.end_datetime} onChange={e => setFormData({ ...formData, end_datetime: e.target.value })} />
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Date (fallback)</label>
                  <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                </div>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
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

      {/* --- ITINERARY MODAL --- */}
      {isItineraryOpen && selectedEventForItinerary && (
        <div className={styles.modalOverlay} onClick={() => setIsItineraryOpen(false)}>
          <div className={styles.itineraryModal} onClick={(e) => e.stopPropagation()}>
            {/* Gradient Header */}
            <div className={styles.itineraryHeader}>
              <div className={styles.itineraryHeaderContent}>
                <div className={styles.itineraryHeaderTop}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                      Event Itinerary
                    </div>
                    <h2>{selectedEventForItinerary.title}</h2>
                  </div>
                  <button className={styles.itineraryCloseBtn} onClick={() => setIsItineraryOpen(false)}>✕</button>
                </div>

                <div className={styles.venueInfoBar}>
                  {selectedEventForItinerary.venue && (
                    <div className={styles.venueInfoItem}>
                      <span className={styles.infoIcon}>🏛️</span>
                      <div>
                        <span className={styles.infoLabel}>Venue</span>
                        <span className={styles.infoValue}>{selectedEventForItinerary.venue}</span>
                      </div>
                    </div>
                  )}
                  {selectedEventForItinerary.start_datetime && (() => {
                    const range = formatDateRange(selectedEventForItinerary.start_datetime, selectedEventForItinerary.end_datetime);
                    return (
                      <>
                        <div className={styles.venueInfoItem}>
                          <span className={styles.infoIcon}>📅</span>
                          <div>
                            <span className={styles.infoLabel}>Date</span>
                            <span className={styles.infoValue}>{range.dateStr}</span>
                          </div>
                        </div>
                        <div className={styles.venueInfoItem}>
                          <span className={styles.infoIcon}>🕐</span>
                          <div>
                            <span className={styles.infoLabel}>Time</span>
                            <span className={styles.infoValue}>{range.startTime}{range.endTime ? ` — ${range.endTime}` : ''}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  {selectedEventForItinerary.location && (
                    <div className={styles.venueInfoItem}>
                      <span className={styles.infoIcon}>📍</span>
                      <div>
                        <span className={styles.infoLabel}>Address</span>
                        <span className={styles.infoValue}>{selectedEventForItinerary.location}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Body — Timeline */}
            <div className={styles.itineraryBody}>
              {activities.length === 0 && !isActivityFormOpen ? (
                <div className={styles.emptyItinerary}>
                  <span className={styles.emptyIcon}>📋</span>
                  <p>No activities yet</p>
                  <span>Add activities to build your event itinerary</span>
                </div>
              ) : (
                <div className={styles.timeline}>
                  {activities.map((activity, idx) => (
                    <div key={activity.id} className={styles.timelineItem} style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className={styles.timelineDot}></div>
                      <div className={styles.activityCard}>
                        <div className={styles.activityTime}>
                          <span className={styles.timeBadge}>{formatTime(activity.start_time)}</span>
                          <span>→</span>
                          <span className={styles.timeBadge}>{formatTime(activity.end_time)}</span>
                        </div>
                        <div className={styles.activityName}>{activity.activity_name}</div>
                        {activity.description && (
                          <div className={styles.activityDesc}>{activity.description}</div>
                        )}
                        {activity.location && (
                          <div className={styles.activityLocation}>📍 {activity.location}</div>
                        )}
                        <div className={styles.activityActions}>
                          <button onClick={() => handleOpenActivityForm(activity)}>✎ Edit</button>
                          <button className={styles.deleteActBtn} onClick={() => handleDeleteActivity(activity.id)}>🗑 Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Activity Form */}
              {isActivityFormOpen ? (
                <div className={styles.activityFormCard}>
                  <h4>{editingActivityId ? 'Edit Activity' : 'Add New Activity'}</h4>
                  <form onSubmit={handleSaveActivity}>
                    <div className={styles.activityFormGrid}>
                      <div className={styles.fullWidth}>
                        <label>Activity Name *</label>
                        <input
                          required
                          type="text"
                          value={activityForm.activity_name}
                          onChange={e => setActivityForm({ ...activityForm, activity_name: e.target.value })}
                          placeholder="e.g. Opening Speech"
                        />
                      </div>
                      <div>
                        <label>Start Time *</label>
                        <input
                          required
                          type="datetime-local"
                          value={activityForm.start_time}
                          onChange={e => setActivityForm({ ...activityForm, start_time: e.target.value })}
                        />
                      </div>
                      <div>
                        <label>End Time *</label>
                        <input
                          required
                          type="datetime-local"
                          value={activityForm.end_time}
                          onChange={e => setActivityForm({ ...activityForm, end_time: e.target.value })}
                        />
                      </div>
                      <div className={styles.fullWidth}>
                        <label>Description</label>
                        <textarea
                          value={activityForm.description}
                          onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
                          placeholder="Brief description of the activity..."
                        />
                      </div>
                      <div className={styles.fullWidth}>
                        <label>Location</label>
                        <input
                          type="text"
                          value={activityForm.location}
                          onChange={e => setActivityForm({ ...activityForm, location: e.target.value })}
                          placeholder="e.g. Main Hall, Room 201"
                        />
                      </div>
                    </div>
                    <div className={styles.activityFormFooter}>
                      <button type="button" className={styles.btnCancel} onClick={() => { setIsActivityFormOpen(false); setEditingActivityId(null); setActivityForm(initialActivityForm); }}>Cancel</button>
                      <button type="submit" className={styles.btnSave}>{editingActivityId ? 'Save Changes' : 'Add Activity'}</button>
                    </div>
                  </form>
                </div>
              ) : (
                <button className={styles.addActivityBtn} onClick={() => handleOpenActivityForm()}>
                  ⊕ Add Activity
                </button>
              )}
            </div>

            {/* Footer */}
            <div className={styles.itineraryFooter}>
              <span className={styles.activityCount}>{activities.length} activit{activities.length === 1 ? 'y' : 'ies'}</span>
              {(selectedEventForItinerary.latitude && selectedEventForItinerary.longitude) && (
                <button className={styles.navigateBtnLg} onClick={() => handleNavigateToVenue(selectedEventForItinerary)}>
                  🧭 Navigate to Venue
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- CALENDAR MODAL OVERLAY --- */}
      {isCalendarOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCalendarOpen(false)}>
          <div className={styles.calendarModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.calHeader}>
              <div className={styles.calHeaderLeft}>
                <button className={styles.calTodayBtn} onClick={handleToday}>Today</button>
                <div className={styles.calArrows}>
                  <span onClick={handlePrevMonth} style={{ cursor: 'pointer', userSelect: 'none' }}>&lt;</span>
                  <span onClick={handleNextMonth} style={{ cursor: 'pointer', userSelect: 'none' }}>&gt;</span>
                </div>
                <h2>{monthNames[currentMonth]} {currentYear}</h2>
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
                const monthStr = String(currentMonth + 1).padStart(2, '0');
                const dayStr = String(day).padStart(2, '0');
                const dateStr = `${currentYear}-${monthStr}-${dayStr}`;
                const dayEvents = eventData.filter(e => e.date === dateStr);
                const hasEvent = dayEvents.length > 0;
                return (
                  <div key={day} className={styles.calCell} style={hasEvent ? { backgroundColor: 'rgba(94, 224, 147, 0.1)', border: '1px solid #5EE093' } : {}}>
                    <span className={styles.calDayNum} style={hasEvent ? { fontWeight: 'bold', color: '#2C3E50' } : {}}>{day}</span>
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