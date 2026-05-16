import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { getLocationWithFallback } from "@/lib/getLocation";
import { buildWeatherContext, detectScheduleConflicts } from '@/lib/aiContext';
import styles from '../styles/event.module.css';
import Sidebar from '@/components/Sidebar';
import ShareModal from '@/components/ShareModal';
import BudgetModal from '@/components/BudgetModal';
import { addMonths, subMonths } from 'date-fns';

import {
  readPendingItinerary,
  clearPendingItinerary,
  buildItineraryEventDraft,
  buildActivityDraftsFromStructured,
} from '@/lib/itineraryImportShared';

// Component Imports
import EventsHeader from '@/components/events/EventsHeader';
import EventsFilterBar from '@/components/events/EventsFilterBar';
import EventList from '@/components/events/EventList';
import EventFormModal from '@/components/events/EventFormModal';
import ItineraryModal from '@/components/events/ItineraryModal';
import CalendarModal from '@/components/events/CalendarModal';

const MAP_PICK_KEY_EVENT = 'scheduleSkies_mapPick_event';
const MAP_PICK_KEY_ACTIVITY = 'scheduleSkies_mapPick_activity';
const MAP_PICK_LEGACY = 'scheduleSkies_mapPick';
const PLAN_RESTORE_STORAGE_KEY = 'scheduleSkies_planRestore';

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

  const fetchEvents = async (currentUserId = userId) => {
    if (!currentUserId) return;
    setLoading(true);

    const { data: ownedEvents, error: ownedError } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', currentUserId);

    if (ownedError) {
      console.error('Failed to fetch owned events:', ownedError);
      setLoading(false);
      return;
    }

    const { data: collabRows, error: collabError } = await supabase
      .from('share_collaborators')
      .select('event_shares!inner(event_id)')
      .eq('user_id', currentUserId);

    if (collabError) console.error('Failed to fetch shared events:', collabError);

    const sharedEventIds = Array.from(new Set(
      (collabRows || [])
        .map(row => Array.isArray(row?.event_shares) ? row.event_shares[0]?.event_id : row?.event_shares?.event_id)
        .filter(Boolean)
    ));

    let sharedEvents = [];
    if (sharedEventIds.length > 0) {
      const { data: sharedData, error: sharedError } = await supabase
        .from('events')
        .select('*')
        .in('id', sharedEventIds);

      if (sharedError) console.error('Failed to load shared event rows:', sharedError);
      else sharedEvents = sharedData || [];
    }

    const taggedOwnedEvents = (ownedEvents || []).map(ev => ({ ...ev, isShared: false }));
    const taggedSharedEvents = (sharedEvents || []).map(ev => ({ ...ev, isShared: true }));

    const mergedById = new Map();
    [...taggedOwnedEvents, ...taggedSharedEvents].forEach(ev => mergedById.set(ev.id, ev));
    const merged = Array.from(mergedById.values()).sort((a, b) => {
      const aDate = a?.date || a?.start_datetime || '';
      const bDate = b?.date || b?.start_datetime || '';
      return aDate.localeCompare(bDate);
    });

    setEventData(merged.map(generateDynamicProps));
    setLoading(false);
  };

  // --- 2. UI & LOCATION STATE ---
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [statusFilter, setStatusFilter] = useState('Upcoming');
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState('Locating...');
  const [currentDate, setCurrentDate] = useState('');
  const [temperature, setTemperature] = useState('--');
  const [loading, setLoading] = useState(true);

  // Modal & Form States
  const [isEditListMode, setIsEditListMode] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [formError, setFormError] = useState('');

  // Clock UI States
  const [showEventStartClock, setShowEventStartClock] = useState(false);
  const [showEventEndClock, setShowEventEndClock] = useState(false);
  const [showActStartClock, setShowActStartClock] = useState(false);
  const [showActEndClock, setShowActEndClock] = useState(false);

  // Calendar States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarDirection, setCalendarDirection] = useState(0); 
  const [calendarViewMode, setCalendarViewMode] = useState('events');
  const [allCalendarActivities, setAllCalendarActivities] = useState([]);
  const [isLoadingAllActivities, setIsLoadingAllActivities] = useState(false);
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);

  // Itinerary States
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const [selectedEventForItinerary, setSelectedEventForItinerary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const initialActivityForm = { activity_name: '', description: '', start_time: '', end_time: '', location: '', latitude: null, longitude: null };
  const [activityForm, setActivityForm] = useState(initialActivityForm);
  const [activityLocationResults, setActivityLocationResults] = useState([]);
  const [isSearchingActivityLocation, setIsSearchingActivityLocation] = useState(false);
  const [completedActivities, setCompletedActivities] = useState({});

  const initialFormState = { title: '', location: '', price: '', date: '', category: 'Food', venue: '', start_datetime: '', end_datetime: '', latitude: null, longitude: null, image_link: '' };
  const [formData, setFormData] = useState(initialFormState);

  // AI Suggestions State
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Share / Budget State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [selectedEventForShare, setSelectedEventForShare] = useState(null);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [selectedEventForBudget, setSelectedEventForBudget] = useState(null);

  const [pendingImport, setPendingImport] = useState(null);
  const [importError, setImportError] = useState('');
  const [importItineraryActive, setImportItineraryActive] = useState(false);
  const [importActivityActive, setImportActivityActive] = useState(false);
  const [importActivityIndex, setImportActivityIndex] = useState(0);

  const categories = ['All Events', 'Food', 'SightSeeing', 'Hotel', 'Leisure'];
  const formCategories = ['Food', 'SightSeeing', 'Hotel', 'Leisure'];

  const [viewMode, setViewMode] = useState('grid');
  const [ownershipFilter, setOwnershipFilter] = useState('all');

  // --- HELPERS ---
  const getTimePart = (dt) => {
    if (!dt || !dt.includes('T')) return '12:00';
    const timeStr = dt.split('T')[1];
    const [h, m] = timeStr.split(':');
    return `${(h || '12').padStart(2, '0')}:${(m || '00').substring(0, 2).padStart(2, '0')}`;
  };

  const getDatePart = (dt) => {
    if (!dt) return new Date().toISOString().split('T')[0];
    return dt.includes('T') ? dt.split('T')[0] : dt;
  };

  const formatDisplayTime = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    return `${hours % 12 || 12}:${m} ${ampm}`;
  };

  const formatTime = (dtStr) => {
    if (!dtStr) return '';
    return new Date(dtStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatDateRange = (start, end) => {
    if (!start) return '';
    const s = new Date(start);
    const e = end ? new Date(end) : null;
    return { 
      dateStr: s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }), 
      startTime: s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }), 
      endTime: e ? e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '' 
    };
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const startDate = event.start_datetime ? new Date(event.start_datetime) : (event.date ? new Date(event.date + 'T00:00:00') : null);
    const endDate = event.end_datetime ? new Date(event.end_datetime) : (event.date ? new Date(event.date + 'T23:59:59') : null);

    if (!startDate && !endDate) return 'upcoming';
    if (endDate && endDate < now) return 'done';
    if (startDate && endDate && startDate <= now && endDate >= now) return 'ongoing';
    return 'upcoming';
  };

  const upcomingOrOngoingEvents = eventData.filter(e => {
    const status = getEventStatus(e);
    return status === 'upcoming' || status === 'ongoing';
  });

  const statusCounts = {
    Ongoing: eventData.filter(e => getEventStatus(e) === 'ongoing').length,
    Upcoming: eventData.filter(e => getEventStatus(e) === 'upcoming').length,
    Done: eventData.filter(e => getEventStatus(e) === 'done').length,
  };

  const sharedWithMeCount = eventData.filter(e => e.isShared).length;
  const myEventsCount = eventData.filter(e => !e.isShared).length;

  const loadCompletedActivities = (eventId) => {
    try {
      const stored = localStorage.getItem(`itinerary_progress_${eventId}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  };

  const saveCompletedActivities = (eventId, completed) => {
    try { localStorage.setItem(`itinerary_progress_${eventId}`, JSON.stringify(completed)); } catch (e) {}
  };

  const toggleActivityComplete = (activityId) => {
    if (!selectedEventForItinerary) return;
    const eventId = selectedEventForItinerary.id;
    const updated = { ...completedActivities, [activityId]: !completedActivities[activityId] };
    setCompletedActivities(updated);
    saveCompletedActivities(eventId, updated);
  };

  const getProgressPercent = () => {
    if (activities.length === 0) return 0;
    const doneCount = activities.filter(a => completedActivities[a.id]).length;
    return Math.round((doneCount / activities.length) * 100);
  };

  // --- 3. FETCH LOCATION & DATE & AUTH ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) router.push('/');
      else { setUserId(session.user.id); fetchEvents(session.user.id); }
    };
    checkUser();

    setCurrentDate(new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));

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
      } catch (err) {}
    };
    fetchWeather();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const stored = readPendingItinerary();
    if (!stored?.structured) { setPendingImport(null); return; }
    const activityDrafts = buildActivityDraftsFromStructured(stored.structured);
    const eventDraft = buildItineraryEventDraft(stored.structured, stored.prompt);
    if (!eventDraft || activityDrafts.length === 0) { clearPendingItinerary(); setPendingImport(null); return; }
    setPendingImport({ prompt: stored.prompt, source: stored.source, structured: stored.structured, eventDraft, activityDrafts });
  }, [userId]);

  const fetchAllUserActivities = async () => {
    const eventIds = eventData.map(e => e.id);
    if (eventIds.length === 0) return;

    setIsLoadingAllActivities(true);
    const { data, error } = await supabase.from('itinerary_activities').select('*').in('event_id', eventIds);
    if (data && !error) setAllCalendarActivities(data);
    setIsLoadingAllActivities(false);
  };

  useEffect(() => {
    if (isCalendarOpen && calendarViewMode === 'activities') fetchAllUserActivities();
  }, [isCalendarOpen, calendarViewMode, eventData]);

  // --- AI ANALYSIS ---
  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setShowAiPanel(true);
    setAiSuggestions([]);

    const targetEvents = upcomingOrOngoingEvents;
    if (targetEvents.length === 0) {
      setAiSuggestions([
        {
          type: 'warning',
          icon: '⚠️',
          title: 'No active events to analyze',
          message: 'AI suggestions are only generated for upcoming and ongoing events. Create or activate an event to get itinerary recommendations.',
        },
      ]);
      setIsAiLoading(false);
      return;
    }

    try {
      const conflicts = detectScheduleConflicts(targetEvents);
      const { lat, lon } = await getLocationWithFallback();
      const weatherCtx = await buildWeatherContext(lat, lon);

      const response = await fetch('/api/ai-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Analyze my itinerary. Check for conflicts, suggest weather-based adjustments, and recommend improvements. Be specific about each event.',
          context: {
            events: targetEvents.map(e => ({
              title: e.title,
              location: e.location,
              date: e.date,
              category: e.category,
              price: e.price,
              status: getEventStatus(e),
            })),
            weather: weatherCtx,
            location: userLocation,
            conflicts,
            currentWeather: { temp: temperature, description: 'Current', city: userLocation },
          },
        }),
      });

      const data = await response.json();
      const newSuggestions = [];

      if (conflicts.length > 0) {
        conflicts.forEach(c => newSuggestions.push({
          type: c.severity === 'warning' ? 'warning' : 'info', icon: c.severity === 'warning' ? '⚠️' : 'ℹ️',
          title: c.type === 'overloaded' ? 'Busy Day Alert' : c.type === 'duplicate_location' ? 'Duplicate Location' : 'Travel Time Check',
          message: c.message,
        }));
      }

      if (data.reply) newSuggestions.push({ type: 'ai', icon: '✨', title: 'AI Itinerary Analysis', message: data.reply });
      if (newSuggestions.length === 0) newSuggestions.push({ type: 'success', icon: '✅', title: 'All Good!', message: 'No issues detected. Your schedule looks well-organized!' });
      
      setAiSuggestions(newSuggestions);
    } catch (err) {
      setAiSuggestions([{ type: 'warning', icon: '⚠️', title: 'Analysis Unavailable', message: 'Could not complete the analysis. Please try again.' }]);
    }
    setIsAiLoading(false);
  };

  const dismissSuggestion = (index) => {
    setAiSuggestions(prev => prev.filter((_, i) => i !== index));
    if (aiSuggestions.length <= 1) setShowAiPanel(false);
  };

  const handleDismissPendingImport = () => {
    clearPendingItinerary(); setPendingImport(null); setImportError('');
    setImportItineraryActive(false); setImportActivityActive(false); setImportActivityIndex(0);
  };

  // --- 4. FORM & EVENT LOGIC ---
  const handleOpenAddForm = () => {
    setImportItineraryActive(false);
    setFormData({ ...initialFormState, date: new Date().toISOString().split('T')[0] });
    setEditingId(null); setFormError(''); setIsFormOpen(true); setLocationResults([]);
  };

  const isoToLocalInput = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleOpenEditForm = (event) => {
    setImportItineraryActive(false);
    setFormData({
      title: event.title, location: event.location, price: event.price,
      date: event.date || new Date().toISOString().split('T')[0],
      category: event.category || 'Food', venue: event.venue || '',
      start_datetime: isoToLocalInput(event.start_datetime),
      end_datetime: isoToLocalInput(event.end_datetime),
      latitude: event.latitude || null, longitude: event.longitude || null
    });
    setEditingId(event.id); setFormError(''); setIsFormOpen(true); setLocationResults([]);
  };

  const applyDraftToForm = (draft) => {
    const locationText = draft.location || '';
    setFormData({
      title: draft.title || '', location: locationText, price: draft.price != null ? String(draft.price) : '',
      date: draft.date || new Date().toISOString().split('T')[0], category: draft.category || 'Food',
      venue: draft.venue || locationText.split(',')[0]?.trim() || '',
      start_datetime: draft.start_datetime ? isoToLocalInput(draft.start_datetime) : '',
      end_datetime: draft.end_datetime ? isoToLocalInput(draft.end_datetime) : '',
      latitude: draft.latitude ?? null, longitude: draft.longitude ?? null,
    });
  };

  const handleStartImportItinerary = () => {
    if (!pendingImport?.eventDraft) return;
    setImportError(''); setImportItineraryActive(true); setEditingId(null);
    applyDraftToForm(pendingImport.eventDraft); setLocationResults([]); setFormError(''); setIsFormOpen(true);
  };

  const closeEventForm = () => {
    setIsFormOpen(false); if (importItineraryActive) setImportItineraryActive(false);
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
    setFormError('');

    const isStartInvalid = formData.start_datetime && isNaN(new Date(formData.start_datetime).getTime());
    const isEndInvalid = formData.end_datetime && isNaN(new Date(formData.end_datetime).getTime());

    if (isStartInvalid) return setFormError('❌ Start date/time is invalid or incomplete. Please re-select the time.');
    if (isEndInvalid) return setFormError('❌ End date/time is invalid or incomplete. Please re-select the time.');

    if (formData.start_datetime) {
      const startTime = new Date(formData.start_datetime);
      if (startTime < new Date()) return setFormError('❌ Cannot create an event in the past. Please choose a future date and time.');
      if (!editingId && startTime < new Date(Date.now() + 5 * 60 * 60 * 1000)) return setFormError('⏰ Event must be at least 5 hours from now. Please choose a later time.');
    }

    if (formData.end_datetime && formData.start_datetime && new Date(formData.end_datetime) <= new Date(formData.start_datetime)) {
      return setFormError('❌ End time must be after start time.');
    }

    const newEventData = {
      title: formData.title, location: formData.location, price: formData.price,
      date: formData.date || (formData.start_datetime ? formData.start_datetime.split('T')[0] : new Date().toISOString().split('T')[0]),
      category: formData.category, user_id: userId, venue: formData.venue || null,
      start_datetime: formData.start_datetime ? new Date(formData.start_datetime).toISOString() : null,
      end_datetime: formData.end_datetime ? new Date(formData.end_datetime).toISOString() : null,
      latitude: formData.latitude || null, longitude: formData.longitude || null,
      image_link: formData.image_link || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop'
    };

    if (editingId) {
      const { data, error } = await supabase.from('events').update(newEventData).eq('id', editingId).select();
      if (data && !error) setEventData(prev => prev.map(ev => ev.id === editingId ? { ...generateDynamicProps(data[0]), isShared: ev.isShared } : ev));
    } else {
      const { data, error } = await supabase.from('events').insert([newEventData]).select();
      if (data && !error) {
        const created = { ...generateDynamicProps(data[0]), isShared: false };
        setEventData(prev => [...prev, created]);
        setActiveFilter('All Events');

        if (importItineraryActive && pendingImport?.activityDrafts?.length) {
          await handleOpenItinerary(created);
          setImportActivityActive(true); setImportActivityIndex(0); setEditingActivityId(null);
          const first = pendingImport.activityDrafts[0];
          setActivityForm({
            activity_name: first.activity_name || '', description: first.description || '',
            start_time: isoToLocalInput(first.start_time), end_time: isoToLocalInput(first.end_time),
            location: first.location || '', latitude: first.latitude ?? null, longitude: first.longitude ?? null,
          });
          setIsActivityFormOpen(true); setImportItineraryActive(false);
        }
      }
    }
    setIsFormOpen(false);
  };

  const fetchPlaceImage = async (locationName) => {
    try {
      const res = await fetch(`/api/place-image?query=${encodeURIComponent(locationName)}`);
      const data = await res.json();
      return data.url || null;
    } catch { return null; }
  };

  const handleLocationSearch = async (val) => {
    setFormData({ ...formData, location: val, latitude: null, longitude: null });
    if (val.length > 2) {
      setIsSearchingLocation(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`);
        const data = await res.json();
        setLocationResults(data);
      } catch (err) {} finally { setIsSearchingLocation(false); }
    } else setLocationResults([]);
  };

  const handleSelectLocation = async (loc) => {
    setFormData({ ...formData, location: loc.display_name, latitude: parseFloat(loc.lat), longitude: parseFloat(loc.lon) });
    setLocationResults([]);
    const imageUrl = await fetchPlaceImage(loc.display_name);
    setFormData(prev => ({ ...prev, image_link: imageUrl || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&auto=format&fit=crop' }));
  };

  const handleActivityLocationSearch = async (val) => {
    setActivityForm({ ...activityForm, location: val, latitude: null, longitude: null });
    if (val.length > 2) {
      setIsSearchingActivityLocation(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`);
        const data = await res.json();
        setActivityLocationResults(data);
      } catch (err) {} finally { setIsSearchingActivityLocation(false); }
    } else setActivityLocationResults([]);
  };

  const handleSelectActivityLocation = (loc) => {
    setActivityForm({ ...activityForm, location: loc.display_name, latitude: parseFloat(loc.lat), longitude: parseFloat(loc.lon) });
    setActivityLocationResults([]);
  };

  // --- 5. ITINERARY LOGIC ---
  const handleOpenItinerary = async (event) => {
    setSelectedEventForItinerary(event); setIsItineraryOpen(true); setIsActivityFormOpen(false);
    setEditingActivityId(null); setActivityForm(initialActivityForm);
    const loaded = loadCompletedActivities(event.id); setCompletedActivities(loaded);
    await fetchActivities(event.id);
  };

  const fetchActivities = async (eventId) => {
    const { data, error } = await supabase.from('itinerary_activities').select('*').eq('event_id', eventId).order('start_time', { ascending: true });
    if (data && !error) setActivities(data);
  };

  const openMapPickerForEvent = () => {
    try { sessionStorage.setItem(PLAN_RESTORE_STORAGE_KEY, JSON.stringify({ type: 'event', formDataSnapshot: formData, editingId })); } catch (e) {}
    const params = new URLSearchParams({ pick: '1', from: 'event', returnTo: '/plan' });
    if (formData.latitude != null && formData.longitude != null) { params.set('lat', String(formData.latitude)); params.set('lng', String(formData.longitude)); }
    if (formData.location) params.set('label', formData.location);
    router.push(`/map?${params.toString()}`);
  };

  const openMapPickerForActivity = () => {
    if (!selectedEventForItinerary) return;
    try { sessionStorage.setItem(PLAN_RESTORE_STORAGE_KEY, JSON.stringify({ type: 'activity', itineraryEventId: selectedEventForItinerary.id, activityFormSnapshot: activityForm, editingActivityId })); } catch (e) {}
    const params = new URLSearchParams({ pick: '1', from: 'activity', returnTo: '/plan' });
    if (activityForm.latitude != null && activityForm.longitude != null) { params.set('lat', String(activityForm.latitude)); params.set('lng', String(activityForm.longitude)); }
    if (activityForm.location) params.set('label', activityForm.location);
    router.push(`/map?${params.toString()}`);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    const consumeTimedMapPick = (storageKey) => {
      const raw = sessionStorage.getItem(storageKey);
      if (!raw) return null;
      try {
        const mapPick = JSON.parse(raw);
        if (Date.now() - mapPick.ts > 10 * 60 * 1000) { sessionStorage.removeItem(storageKey); return null; }
        sessionStorage.removeItem(storageKey); return mapPick;
      } catch { sessionStorage.removeItem(storageKey); return null; }
    };

    const restoreRaw = sessionStorage.getItem(PLAN_RESTORE_STORAGE_KEY);
    if (restoreRaw) {
      try {
        const restore = JSON.parse(restoreRaw);
        if (restore.type === 'event') {
          sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY);
          setFormData(restore.formDataSnapshot); setEditingId(restore.editingId ?? null); setIsFormOpen(true);
        } else if (restore.type === 'activity' && restore.itineraryEventId && eventData.length > 0) {
          const ev = eventData.find(e => e.id === restore.itineraryEventId);
          if (ev) {
            sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY); setSelectedEventForItinerary(ev); setIsItineraryOpen(true);
            setActivityForm(restore.activityFormSnapshot || initialActivityForm); setIsActivityFormOpen(true);
            setEditingActivityId(restore.editingActivityId ?? null); fetchActivities(restore.itineraryEventId);
          }
        }
      } catch { sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY); }
    }

    const actPick = consumeTimedMapPick(MAP_PICK_KEY_ACTIVITY);
    if (actPick?.context === 'activity') setActivityForm(prev => ({ ...prev, location: actPick.label || prev.location, latitude: actPick.lat, longitude: actPick.lng }));

    const evtPick = consumeTimedMapPick(MAP_PICK_KEY_EVENT);
    if (evtPick?.context === 'event') setFormData(prev => ({ ...prev, location: evtPick.label || prev.location, latitude: evtPick.lat, longitude: evtPick.lng }));

    const legacyPick = consumeTimedMapPick(MAP_PICK_LEGACY);
    if (legacyPick) {
      if (legacyPick.context === 'activity') setActivityForm(prev => ({ ...prev, location: legacyPick.label || prev.location, latitude: legacyPick.lat, longitude: legacyPick.lng }));
      else if (legacyPick.context !== 'shared-activity') setFormData(prev => ({ ...prev, location: legacyPick.label || prev.location, latitude: legacyPick.lat, longitude: legacyPick.lng }));
    }
  }, [userId, eventData]);

  const handleOpenActivityForm = (activity = null) => {
    if (activity) {
      setActivityForm({
        activity_name: activity.activity_name, description: activity.description || '',
        start_time: isoToLocalInput(activity.start_time), end_time: isoToLocalInput(activity.end_time),
        location: activity.location || '', latitude: activity.latitude || null, longitude: activity.longitude || null
      });
      setEditingActivityId(activity.id);
    } else { setActivityForm(initialActivityForm); setEditingActivityId(null); }
    setIsActivityFormOpen(true); setActivityLocationResults([]);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!userId || !selectedEventForItinerary) return;

    const eventStart = new Date(selectedEventForItinerary.start_datetime);
    const eventEnd = new Date(selectedEventForItinerary.end_datetime);
    const activityStart = new Date(activityForm.start_time);
    const activityEnd = new Date(activityForm.end_time);

    if (activityStart < eventStart || activityEnd > eventEnd) return alert("Activity start and end times must be within the event's start and end times.");
    if (activityStart >= activityEnd) return alert("Activity end time must be after the start time.");

    const activityData = {
      event_id: selectedEventForItinerary.id, user_id: userId, activity_name: activityForm.activity_name,
      description: activityForm.description || null, start_time: activityForm.start_time ? new Date(activityForm.start_time).toISOString() : null,
      end_time: activityForm.end_time ? new Date(activityForm.end_time).toISOString() : null,
      location: activityForm.location || null, latitude: activityForm.latitude, longitude: activityForm.longitude,
      sort_order: importActivityActive ? importActivityIndex : activities.length
    };

    if (editingActivityId) {
      const { data, error } = await supabase.from('itinerary_activities').update(activityData).eq('id', editingActivityId).select();
      if (data && !error) setActivities(prev => prev.map(a => a.id === editingActivityId ? data[0] : a));
    } else {
      const { data, error } = await supabase.from('itinerary_activities').insert([activityData]).select();
      if (data && !error) {
        setActivities(prev => [...prev, data[0]]);
        if (importActivityActive && pendingImport?.activityDrafts?.length) {
          const nextIdx = importActivityIndex + 1;
          if (nextIdx < pendingImport.activityDrafts.length) {
            const next = pendingImport.activityDrafts[nextIdx];
            setImportActivityIndex(nextIdx); setEditingActivityId(null);
            setActivityForm({
              activity_name: next.activity_name || '', description: next.description || '',
              start_time: isoToLocalInput(next.start_time), end_time: isoToLocalInput(next.end_time),
              location: next.location || '', latitude: next.latitude ?? null, longitude: next.longitude ?? null,
            });
            setIsActivityFormOpen(true); return;
          }
          clearPendingItinerary(); setPendingImport(null); setImportActivityActive(false); setImportActivityIndex(0);
        }
      }
    }
    setIsActivityFormOpen(false); setEditingActivityId(null); setActivityForm(initialActivityForm);
  };

  const handleDeleteActivity = async (id) => {
    if (window.confirm("Delete this activity?")) {
      await supabase.from('itinerary_activities').delete().eq('id', id);
      setActivities(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleNavigateToVenue = (event) => {
    if (event.latitude && event.longitude) router.push(`/map?lat=${event.latitude}&lng=${event.longitude}&label=${encodeURIComponent(event.venue || event.location)}`);
    else router.push(`/map`);
  };

  const handleNavigateItinerary = (event, activitiesList) => {
    const waypoints = [];
    if (event.latitude && event.longitude) waypoints.push({ lat: parseFloat(event.latitude), lng: parseFloat(event.longitude), label: event.venue || event.location || 'Event Venue' });
    activitiesList.forEach(a => {
      if (a.location && a.location.trim()) {
        if (a.latitude && a.longitude) waypoints.push({ lat: parseFloat(a.latitude), lng: parseFloat(a.longitude), label: a.location, activityName: a.activity_name });
        else waypoints.push({ label: a.location, activityName: a.activity_name });
      }
    });
    if (waypoints.length > 0) router.push(`/map?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`);
    else router.push(`/map`);
  };

  const filteredEvents = eventData.filter(event => {
    const matchesCategory = activeFilter === 'All Events' || event.tags.some(tag => tag.label.toLowerCase().includes(activeFilter.toLowerCase()));
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) || event.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || getEventStatus(event) === statusFilter.toLowerCase();
    const matchesOwnership = ownershipFilter === 'all' || (ownershipFilter === 'mine' && !event.isShared) || (ownershipFilter === 'shared' && event.isShared);
    return matchesCategory && matchesSearch && matchesStatus && matchesOwnership;
  });

  const handlePrevMonth = () => { setCalendarDirection(-1); setCalendarDate(prev => subMonths(prev, 1)); };
  const handleNextMonth = () => { setCalendarDirection(1); setCalendarDate(prev => addMonths(prev, 1)); };
  const handleToday = () => { setCalendarDirection(0); setCalendarDate(new Date()); };
  const handleMonthDragEnd = (event, info) => { if (info.offset.x < -50) handleNextMonth(); else if (info.offset.x > 50) handlePrevMonth(); };
  
  const getEventCalendarDate = (event) => event.date || (event.start_datetime ? event.start_datetime.split('T')[0] : null);
  const handleDragStart = (eventId) => setDraggedEventId(eventId);
  const handleDragEnd = () => { setDraggedEventId(null); setDragOverDate(null); };

  const handleDropOnDate = async (dateStr) => {
    if (!draggedEventId) return;
    const event = eventData.find(ev => String(ev.id) === String(draggedEventId));
    if (!event) return;
    if (getEventCalendarDate(event) === dateStr) return handleDragEnd();
    
    const updateData = { date: dateStr };
    if (event.start_datetime) {
      const start = new Date(event.start_datetime);
      const [year, month, day] = dateStr.split('-').map(Number);
      const newStart = new Date(start); newStart.setFullYear(year, month - 1, day);
      updateData.start_datetime = newStart.toISOString();
    }
    if (event.end_datetime) {
      const end = new Date(event.end_datetime);
      const [year, month, day] = dateStr.split('-').map(Number);
      const newEnd = new Date(end); newEnd.setFullYear(year, month - 1, day);
      updateData.end_datetime = newEnd.toISOString();
    }

    const { data, error } = await supabase.from('events').update(updateData).eq('id', event.id).select();
    if (data && !error) setEventData(prev => prev.map(ev => ev.id === event.id ? { ...generateDynamicProps(data[0]), isShared: ev.isShared } : ev));
    handleDragEnd();
  };

  const calendarConflictEventIds = new Set();
  const grouped = {};
  eventData.forEach(event => {
    const date = getEventCalendarDate(event);
    if (!date) return;
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  });
  Object.values(grouped).forEach(events => {
    const sorted = [...events].sort((a, b) => (a.start_datetime ? new Date(a.start_datetime) : new Date(`${getEventCalendarDate(a)}T00:00:00`)) - (b.start_datetime ? new Date(b.start_datetime) : new Date(`${getEventCalendarDate(b)}T00:00:00`)));
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const aStart = a.start_datetime ? new Date(a.start_datetime) : new Date(`${getEventCalendarDate(a)}T00:00:00`);
      const aEnd = a.end_datetime ? new Date(a.end_datetime) : new Date(`${getEventCalendarDate(a)}T23:59:59`);
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const bStart = b.start_datetime ? new Date(b.start_datetime) : new Date(`${getEventCalendarDate(b)}T00:00:00`);
        const bEnd = b.end_datetime ? new Date(b.end_datetime) : new Date(`${getEventCalendarDate(b)}T23:59:59`);
        if (aEnd > bStart && aStart < bEnd) { calendarConflictEventIds.add(a.id); calendarConflictEventIds.add(b.id); }
      }
    }
  });

  return (
    <div className={styles.appContainer}>
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <Sidebar />
      </div>

      <main className={styles.mainContent}>
        <div className={styles.sun}></div>
        <div className={`${styles.cloud} ${styles.cloud1}`}></div>
        <div className={`${styles.cloud} ${styles.cloud2}`}></div>

        <EventsHeader 
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          temperature={temperature} userLocation={userLocation} currentDate={currentDate}
        />

        {pendingImport && (
          <section style={{ marginBottom: '14px', padding: '14px 16px', borderRadius: '14px', border: '1px solid rgba(37, 99, 235, 0.25)', background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(255, 255, 255, 0.98))', boxShadow: '0 8px 24px rgba(37, 99, 235, 0.08)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e3a8a', fontWeight: 700 }}>Itinerary from home demo</h2>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.55, maxWidth: '62ch' }}>
                  {pendingImport.prompt && <><strong >Prompt:</strong> {pendingImport.prompt}<br /></>}
                  {pendingImport.structured?.summary && <><strong>Summary:</strong> {pendingImport.structured.summary}<br /></>}
                  Create <strong>one event</strong> for this itinerary, then add <strong>{pendingImport.activityDrafts.length}</strong> places as activities inside that event.
                </p>
                {importError && <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#b91c1c', fontWeight: 600 }}>{importError}</p>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <button type="button" onClick={handleStartImportItinerary} style={{ border: 'none', borderRadius: '10px', padding: '10px 14px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', background: '#2563eb', color: '#fff' }}>Create itinerary event</button>
                <button type="button" onClick={handleDismissPendingImport} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px 14px', fontWeight: 600, fontSize: '13px', cursor: 'pointer', background: '#fff', color: '#334155' }}>Dismiss</button>
              </div>
            </div>
          </section>
        )}

        <EventsFilterBar 
          statusFilter={statusFilter} setStatusFilter={setStatusFilter} statusCounts={statusCounts}
          ownershipFilter={ownershipFilter} setOwnershipFilter={setOwnershipFilter} eventData={eventData}
          myEventsCount={myEventsCount} sharedWithMeCount={sharedWithMeCount}
          activeFilter={activeFilter} setActiveFilter={setActiveFilter} categories={categories}
          setIsCalendarOpen={setIsCalendarOpen} handleOpenAddForm={handleOpenAddForm}
          isEditListMode={isEditListMode} setIsEditListMode={setIsEditListMode}
          handleAiAnalysis={handleAiAnalysis} isAiLoading={isAiLoading} viewMode={viewMode} setViewMode={setViewMode}
        />

        {showAiPanel && aiSuggestions.length > 0 && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', color: '#1a365d', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>✨ AI Suggestions</h3>
              <button onClick={() => { setShowAiPanel(false); setAiSuggestions([]); }} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '16px', padding: '2px 6px' }}>✕</button>
            </div>
            {aiSuggestions.map((s, i) => (
              <div key={i} style={{ background: s.type === 'warning' ? 'rgba(237, 137, 54, 0.08)' : s.type === 'success' ? 'rgba(72, 187, 120, 0.08)' : 'rgba(102, 126, 234, 0.08)', border: `1px solid ${s.type === 'warning' ? 'rgba(237, 137, 54, 0.25)' : s.type === 'success' ? 'rgba(72, 187, 120, 0.25)' : 'rgba(102, 126, 234, 0.2)'}`, borderRadius: '12px', padding: '12px 14px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px' }}>{s.icon}</span><strong style={{ fontSize: '13px', color: '#2d3748' }}>{s.title}</strong>
                  <button onClick={() => dismissSuggestion(i)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                </div>
                <div style={{ fontSize: '12.5px', color: '#4a5568', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{s.message}</div>
              </div>
            ))}
          </section>
        )}

        {isAiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '16px', marginBottom: '12px', background: 'rgba(102, 126, 234, 0.06)', borderRadius: '12px', border: '1px solid rgba(102, 126, 234, 0.15)' }}>
            <span style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>✨</span><span style={{ fontSize: '13px', color: '#5a67d8', fontWeight: 600 }}>Analyzing your itinerary...</span>
          </div>
        )}

        {loading ? (
          <div className="spinner-container"><div className="loading-spinner"></div></div>
        ) : (
          <EventList 
            events={filteredEvents} viewMode={viewMode} isEditListMode={isEditListMode}
            handleOpenItinerary={handleOpenItinerary} handleOpenEditForm={handleOpenEditForm} handleDeleteEvent={handleDeleteEvent}
            ownershipFilter={ownershipFilter} sharedWithMeCount={sharedWithMeCount} myEventsCount={myEventsCount} statusFilter={statusFilter}
            getEventStatus={getEventStatus} formatDateRange={formatDateRange}
          />
        )}
      </main>

      {/* Extracted Modals */}
      <EventFormModal 
        isOpen={isFormOpen} onClose={closeEventForm} onSave={handleSaveEvent} editingId={editingId}
        importItineraryActive={importItineraryActive} pendingImport={pendingImport} formData={formData} setFormData={setFormData} formError={formError}
        locationResults={locationResults} handleLocationSearch={handleLocationSearch} handleSelectLocation={handleSelectLocation} openMapPickerForEvent={openMapPickerForEvent}
        showEventStartClock={showEventStartClock} setShowEventStartClock={setShowEventStartClock} showEventEndClock={showEventEndClock} setShowEventEndClock={setShowEventEndClock}
        formCategories={formCategories} getDatePart={getDatePart} getTimePart={getTimePart} formatDisplayTime={formatDisplayTime}
      />

      <ItineraryModal 
        isOpen={isItineraryOpen} onClose={() => setIsItineraryOpen(false)} event={selectedEventForItinerary} setEvent={setSelectedEventForItinerary} userId={userId} router={router}
        activities={activities} completedActivities={completedActivities} progressPercent={getProgressPercent()} toggleActivityComplete={toggleActivityComplete}
        formatTime={formatTime} formatDateRange={formatDateRange} isActivityFormOpen={isActivityFormOpen} setIsActivityFormOpen={setIsActivityFormOpen} handleOpenActivityForm={handleOpenActivityForm}
        handleSaveActivity={handleSaveActivity} handleDeleteActivity={handleDeleteActivity} editingActivityId={editingActivityId} setEditingActivityId={setEditingActivityId}
        activityForm={activityForm} setActivityForm={setActivityForm} initialActivityForm={initialActivityForm} activityLocationResults={activityLocationResults} handleActivityLocationSearch={handleActivityLocationSearch}
        handleSelectActivityLocation={handleSelectActivityLocation} openMapPickerForActivity={openMapPickerForActivity} showActStartClock={showActStartClock} setShowActStartClock={setShowActStartClock}
        showActEndClock={showActEndClock} setShowActEndClock={setShowActEndClock} getDatePart={getDatePart} getTimePart={getTimePart} formatDisplayTime={formatDisplayTime}
        onShare={() => { setSelectedEventForShare(selectedEventForItinerary); setIsShareModalOpen(true); }}
        onBudget={() => { setSelectedEventForBudget(selectedEventForItinerary); setIsBudgetOpen(true); }}
        onNavigateVenue={() => handleNavigateToVenue(selectedEventForItinerary)}
        onNavigateItinerary={() => handleNavigateItinerary(selectedEventForItinerary, activities)}
      />

      <CalendarModal 
        isOpen={isCalendarOpen} onClose={() => setIsCalendarOpen(false)} calendarDate={calendarDate} calendarDirection={calendarDirection}
        handleToday={handleToday} handlePrevMonth={handlePrevMonth} handleNextMonth={handleNextMonth} handleMonthDragEnd={handleMonthDragEnd}
        calendarViewMode={calendarViewMode} setCalendarViewMode={setCalendarViewMode} isLoadingAllActivities={isLoadingAllActivities}
        eventData={eventData} allCalendarActivities={allCalendarActivities} calendarConflictEventIds={calendarConflictEventIds}
        handleDropOnDate={handleDropOnDate} dragOverDate={dragOverDate} setDragOverDate={setDragOverDate} handleDragStart={handleDragStart} handleDragEnd={handleDragEnd}
        formatTime={formatTime} getEventCalendarDate={getEventCalendarDate}
      />

      {isShareModalOpen && selectedEventForShare && <ShareModal event={selectedEventForShare} onClose={() => { setIsShareModalOpen(false); setSelectedEventForShare(null); }} />}
      {isBudgetOpen && selectedEventForBudget && <BudgetModal event={selectedEventForBudget} activities={activities} onClose={() => { setIsBudgetOpen(false); setSelectedEventForBudget(null); }} />}
    </div>
  );
};

export default MyEvents;