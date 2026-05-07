import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { getLocationWithFallback } from "@/lib/getLocation";
import { buildWeatherContext, detectScheduleConflicts } from '@/lib/aiContext';
import styles from '../styles/event.module.css';
import Sidebar from '@/components/Sidebar';
import ShareModal from '@/components/ShareModal';
import BudgetModal from '@/components/BudgetModal';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TimeKeeper from 'react-timekeeper';
import { 
  addMonths, subMonths, format, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, addDays, isToday 
} from 'date-fns';
import {
  readPendingItinerary,
  clearPendingItinerary,
  buildItineraryEventDraft,
  buildActivityDraftsFromStructured,
} from '@/lib/itineraryImportShared';

const MAP_PICK_STORAGE_KEY = 'scheduleSkies_mapPick';
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

  const fetchEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data && !error) {
      setEventData(data.map(generateDynamicProps));
      setLoading(false);
    }
  };

  // --- 2. UI & LOCATION STATE ---
  const [activeFilter, setActiveFilter] = useState('All Events');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState('Locating...');
  const [currentDate, setCurrentDate] = useState('');
  const [temperature, setTemperature] = useState('--');
  const [loading, setLoading] = useState(true);

  // Modal & Form States
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarDirection, setCalendarDirection] = useState(0); 
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

  // Itinerary States
  const [isItineraryOpen, setIsItineraryOpen] = useState(false);
  const [selectedEventForItinerary, setSelectedEventForItinerary] = useState(null);
  const [activities, setActivities] = useState([]);
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const initialActivityForm = { activity_name: '', description: '', start_time: '', end_time: '', location: '', latitude: null, longitude: null };
  const [activityForm, setActivityForm] = useState(initialActivityForm);
  const [draggedEventId, setDraggedEventId] = useState(null);
  const [dragOverDate, setDragOverDate] = useState(null);
  const [activityLocationResults, setActivityLocationResults] = useState([]);
  const [isSearchingActivityLocation, setIsSearchingActivityLocation] = useState(false);

  // Progress bar
  const [completedActivities, setCompletedActivities] = useState({});

  const initialFormState = { title: '', location: '', price: '', date: '', category: 'Food', venue: '', start_datetime: '', end_datetime: '', latitude: null, longitude: null };
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

  // --- HELPERS ---
  const getTimePart = (dt) => dt && dt.includes('T') ? dt.split('T')[1].substring(0, 5) : '12:00';
  const getDatePart = (dt) => dt && dt.includes('T') ? dt.split('T')[0] : new Date().toISOString().split('T')[0];

  // Helper to display 24h string (14:30) as 12h string (2:30 PM)
  const formatDisplayTime = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${m} ${ampm}`;
  };

  const getEventStatus = (event) => {
    const now = new Date();
    const endDate = event.end_datetime ? new Date(event.end_datetime) : (event.date ? new Date(event.date + 'T23:59:59') : null);
    const startDate = event.start_datetime ? new Date(event.start_datetime) : (event.date ? new Date(event.date + 'T00:00:00') : null);
    if (!endDate && !startDate) return 'upcoming';
    if (endDate && endDate < now) return 'done';
    return 'upcoming';
  };

  const statusCounts = {
    All: eventData.length,
    Upcoming: eventData.filter(e => getEventStatus(e) === 'upcoming').length,
    Done: eventData.filter(e => getEventStatus(e) === 'done').length,
  };

  const loadCompletedActivities = (eventId) => {
    try {
      const stored = localStorage.getItem(`itinerary_progress_${eventId}`);
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  };

  const saveCompletedActivities = (eventId, completed) => {
    try {
      localStorage.setItem(`itinerary_progress_${eventId}`, JSON.stringify(completed));
    } catch (e) { console.error('Failed to save progress:', e); }
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
      if (!session) {
        router.push('/');
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

  useEffect(() => {
    if (!userId) return;
    const stored = readPendingItinerary();
    if (!stored?.structured) {
      setPendingImport(null);
      return;
    }
    const activityDrafts = buildActivityDraftsFromStructured(stored.structured);
    const eventDraft = buildItineraryEventDraft(stored.structured, stored.prompt);
    if (!eventDraft || activityDrafts.length === 0) {
      clearPendingItinerary();
      setPendingImport(null);
      return;
    }
    setPendingImport({
      prompt: stored.prompt,
      source: stored.source,
      structured: stored.structured,
      eventDraft,
      activityDrafts,
    });
  }, [userId]);

  // --- AI ANALYSIS ---
  const handleAiAnalysis = async () => {
    setIsAiLoading(true);
    setShowAiPanel(true);
    setAiSuggestions([]);

    try {
      const conflicts = detectScheduleConflicts(eventData);
      const { lat, lon } = await getLocationWithFallback();
      const weatherCtx = await buildWeatherContext(lat, lon);

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

      if (data.reply) {
        newSuggestions.push({ type: 'ai', icon: '✨', title: 'AI Itinerary Analysis', message: data.reply });
      }

      if (newSuggestions.length === 0) {
        newSuggestions.push({ type: 'success', icon: '✅', title: 'All Good!', message: 'No issues detected. Your schedule looks well-organized!' });
      }

      setAiSuggestions(newSuggestions);
    } catch (err) {
      console.error('AI analysis failed:', err);
      setAiSuggestions([{ type: 'warning', icon: '⚠️', title: 'Analysis Unavailable', message: 'Could not complete the analysis. Please try again.' }]);
    }

    setIsAiLoading(false);
  };

  const dismissSuggestion = (index) => {
    setAiSuggestions(prev => prev.filter((_, i) => i !== index));
    if (aiSuggestions.length <= 1) setShowAiPanel(false);
  };

  const handleDismissPendingImport = () => {
    clearPendingItinerary();
    setPendingImport(null);
    setImportError('');
    setImportItineraryActive(false);
    setImportActivityActive(false);
    setImportActivityIndex(0);
  };

  // --- 4. FORM & EVENT LOGIC ---
  const handleOpenAddForm = () => {
    setImportItineraryActive(false);
    // Initialize date to current date to act as fallback if start/end aren't filled
    setFormData({ ...initialFormState, date: new Date().toISOString().split('T')[0] });
    setEditingId(null);
    setFormError('');
    setIsFormOpen(true);
    setLocationResults([]);
  };

  const isoToLocalInput = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleOpenEditForm = (event) => {
    setImportItineraryActive(false);
    setFormData({
      title: event.title,
      location: event.location,
      price: event.price,
      date: event.date || new Date().toISOString().split('T')[0],
      category: event.category || 'Food',
      venue: event.venue || '',
      start_datetime: isoToLocalInput(event.start_datetime),
      end_datetime: isoToLocalInput(event.end_datetime),
      latitude: event.latitude || null,
      longitude: event.longitude || null
    });
    setEditingId(event.id);
    setFormError('');
    setIsFormOpen(true);
    setLocationResults([]);
  };

  const applyDraftToForm = (draft) => {
    const locationText = draft.location || '';
    const derivedVenue = draft.venue || locationText.split(',')[0]?.trim() || '';

    setFormData({
      title: draft.title || '',
      location: locationText,
      price: draft.price != null ? String(draft.price) : '',
      date: draft.date || new Date().toISOString().split('T')[0],
      category: draft.category || 'Food',
      venue: derivedVenue,
      start_datetime: draft.start_datetime ? isoToLocalInput(draft.start_datetime) : '',
      end_datetime: draft.end_datetime ? isoToLocalInput(draft.end_datetime) : '',
      latitude: draft.latitude ?? null,
      longitude: draft.longitude ?? null,
    });
  };

  const handleStartImportItinerary = () => {
    if (!pendingImport?.eventDraft) return;
    setImportError('');
    setImportItineraryActive(true);
    setEditingId(null);
    applyDraftToForm(pendingImport.eventDraft);
    setLocationResults([]);
    setFormError('');
    setIsFormOpen(true);
  };

  const closeEventForm = () => {
    setIsFormOpen(false);
    if (importItineraryActive) setImportItineraryActive(false);
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

    if (formData.start_datetime) {
      const startTime = new Date(formData.start_datetime);
      const now = new Date();
      const fiveHoursFromNow = new Date(now.getTime() + 5 * 60 * 60 * 1000);

      if (startTime < now) {
        setFormError('❌ Cannot create an event in the past. Please choose a future date and time.');
        return;
      }

      if (!editingId && startTime < fiveHoursFromNow) {
        setFormError('⏰ Event must be at least 5 hours from now. Please choose a later time.');
        return;
      }
    }

    if (formData.end_datetime && formData.start_datetime) {
      if (new Date(formData.end_datetime) <= new Date(formData.start_datetime)) {
        setFormError('❌ End time must be after start time.');
        return;
      }
    }

    const newEventData = {
      title: formData.title,
      location: formData.location,
      price: formData.price,
      // Date acts as a creation/fallback date, invisible to the user in the UI.
      date: formData.date || (formData.start_datetime ? formData.start_datetime.split('T')[0] : new Date().toISOString().split('T')[0]),
      category: formData.category,
      user_id: userId,
      venue: formData.venue || null,
      start_datetime: formData.start_datetime ? new Date(formData.start_datetime).toISOString() : null,
      end_datetime: formData.end_datetime ? new Date(formData.end_datetime).toISOString() : null,
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
        const created = generateDynamicProps(data[0]);
        setEventData(prev => [...prev, created]);
        setActiveFilter('All Events');

        if (importItineraryActive && pendingImport?.activityDrafts?.length) {
          await handleOpenItinerary(created);
          setImportActivityActive(true);
          setImportActivityIndex(0);
          setEditingActivityId(null);
          const first = pendingImport.activityDrafts[0];
          setActivityForm({
            activity_name: first.activity_name || '',
            description: first.description || '',
            start_time: isoToLocalInput(first.start_time),
            end_time: isoToLocalInput(first.end_time),
            location: first.location || '',
            latitude: first.latitude ?? null,
            longitude: first.longitude ?? null,
          });
          setIsActivityFormOpen(true);
          setImportItineraryActive(false);
        }
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

  const handleActivityLocationSearch = async (val) => {
    setActivityForm({ ...activityForm, location: val, latitude: null, longitude: null });
    if (val.length > 2) {
      setIsSearchingActivityLocation(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`);
        const data = await res.json();
        setActivityLocationResults(data);
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingActivityLocation(false);
      }
    } else {
      setActivityLocationResults([]);
    }
  };

  const handleSelectActivityLocation = (loc) => {
    setActivityForm({
      ...activityForm,
      location: loc.display_name,
      latitude: parseFloat(loc.lat),
      longitude: parseFloat(loc.lon)
    });
    setActivityLocationResults([]);
  };

  // --- 5. ITINERARY LOGIC ---
  const handleOpenItinerary = async (event) => {
    setSelectedEventForItinerary(event);
    setIsItineraryOpen(true);
    setIsActivityFormOpen(false);
    setEditingActivityId(null);
    setActivityForm(initialActivityForm);
    const loaded = loadCompletedActivities(event.id);
    setCompletedActivities(loaded);
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

  const openMapPickerForEvent = () => {
    try {
      sessionStorage.setItem(PLAN_RESTORE_STORAGE_KEY, JSON.stringify({
        type: 'event',
        formDataSnapshot: formData,
        editingId,
      }));
    } catch (e) {
      console.error(e);
    }
    const params = new URLSearchParams({ pick: '1', from: 'event', returnTo: '/plan' });
    if (formData.latitude != null && formData.longitude != null) {
      params.set('lat', String(formData.latitude));
      params.set('lng', String(formData.longitude));
    }
    if (formData.location) params.set('label', formData.location);
    router.push(`/map?${params.toString()}`);
  };

  const openMapPickerForActivity = () => {
    if (!selectedEventForItinerary) return;
    try {
      sessionStorage.setItem(PLAN_RESTORE_STORAGE_KEY, JSON.stringify({
        type: 'activity',
        itineraryEventId: selectedEventForItinerary.id,
        activityFormSnapshot: activityForm,
        editingActivityId,
      }));
    } catch (e) {
      console.error(e);
    }
    const params = new URLSearchParams({ pick: '1', from: 'activity', returnTo: '/plan' });
    if (activityForm.latitude != null && activityForm.longitude != null) {
      params.set('lat', String(activityForm.latitude));
      params.set('lng', String(activityForm.longitude));
    }
    if (activityForm.location) params.set('label', activityForm.location);
    router.push(`/map?${params.toString()}`);
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !userId) return;
    const restoreRaw = sessionStorage.getItem(PLAN_RESTORE_STORAGE_KEY);
    const pickRaw = sessionStorage.getItem(MAP_PICK_STORAGE_KEY);
    if (!restoreRaw && !pickRaw) return;

    if (restoreRaw) {
      try {
        const restore = JSON.parse(restoreRaw);
        if (restore.type === 'event') {
          sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY);
          setFormData(restore.formDataSnapshot);
          setEditingId(restore.editingId ?? null);
          setIsFormOpen(true);
        }
      } catch {
        sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY);
      }
    }

    if (pickRaw) {
      try {
        const mapPick = JSON.parse(pickRaw);
        if (Date.now() - mapPick.ts > 10 * 60 * 1000) {
          sessionStorage.removeItem(MAP_PICK_STORAGE_KEY);
          return;
        }
        if (mapPick.context !== 'activity') {
          sessionStorage.removeItem(MAP_PICK_STORAGE_KEY);
          setFormData(prev => ({
            ...prev,
            location: mapPick.label || prev.location,
            latitude: mapPick.lat,
            longitude: mapPick.lng,
          }));
        }
      } catch {
        sessionStorage.removeItem(MAP_PICK_STORAGE_KEY);
      }
    }
  }, [userId]);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId || eventData.length === 0) return;
    const restoreRaw = sessionStorage.getItem(PLAN_RESTORE_STORAGE_KEY);
    const pickRaw = sessionStorage.getItem(MAP_PICK_STORAGE_KEY);
    if (!restoreRaw && !pickRaw) return;

    if (restoreRaw) {
      try {
        const restore = JSON.parse(restoreRaw);
        if (restore.type === 'activity' && restore.itineraryEventId) {
          const ev = eventData.find(e => e.id === restore.itineraryEventId);
          if (ev) {
            sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY);
            setSelectedEventForItinerary(ev);
            setIsItineraryOpen(true);
            setActivityForm(restore.activityFormSnapshot || initialActivityForm);
            setIsActivityFormOpen(true);
            setEditingActivityId(restore.editingActivityId ?? null);
            fetchActivities(restore.itineraryEventId);
          }
        }
      } catch {
        sessionStorage.removeItem(PLAN_RESTORE_STORAGE_KEY);
      }
    }

    if (pickRaw) {
      try {
        const mapPick = JSON.parse(pickRaw);
        if (Date.now() - mapPick.ts > 10 * 60 * 1000) {
          sessionStorage.removeItem(MAP_PICK_STORAGE_KEY);
          return;
        }
        if (mapPick.context === 'activity') {
          sessionStorage.removeItem(MAP_PICK_STORAGE_KEY);
          setActivityForm(prev => ({
            ...prev,
            location: mapPick.label || prev.location,
            latitude: mapPick.lat,
            longitude: mapPick.lng,
          }));
        }
      } catch {
        sessionStorage.removeItem(MAP_PICK_STORAGE_KEY);
      }
    }
  }, [userId, eventData]);

  const handleOpenActivityForm = (activity = null) => {
    if (activity) {
      setActivityForm({
        activity_name: activity.activity_name,
        description: activity.description || '',
        start_time: isoToLocalInput(activity.start_time),
        end_time: isoToLocalInput(activity.end_time),
        location: activity.location || '',
        latitude: activity.latitude || null,
        longitude: activity.longitude || null
      });
      setEditingActivityId(activity.id);
    } else {
      setActivityForm(initialActivityForm);
      setEditingActivityId(null);
    }
    setIsActivityFormOpen(true);
    setActivityLocationResults([]);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    if (!userId || !selectedEventForItinerary) return;

    const eventStart = new Date(selectedEventForItinerary.start_datetime);
    const eventEnd = new Date(selectedEventForItinerary.end_datetime);
    const activityStart = new Date(activityForm.start_time);
    const activityEnd = new Date(activityForm.end_time);

    if (activityStart < eventStart || activityEnd > eventEnd) {
      alert("Activity start and end times must be within the event's start and end times.");
      return;
    }

    if (activityStart >= activityEnd) {
      alert("Activity end time must be after the start time.");
      return;
    }

    const activityData = {
      event_id: selectedEventForItinerary.id,
      user_id: userId,
      activity_name: activityForm.activity_name,
      description: activityForm.description || null,
      start_time: activityForm.start_time ? new Date(activityForm.start_time).toISOString() : null,
      end_time: activityForm.end_time ? new Date(activityForm.end_time).toISOString() : null,
      location: activityForm.location || null,
      latitude: activityForm.latitude,
      longitude: activityForm.longitude,
      sort_order: importActivityActive ? importActivityIndex : activities.length
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
        if (importActivityActive && pendingImport?.activityDrafts?.length) {
          const nextIdx = importActivityIndex + 1;
          if (nextIdx < pendingImport.activityDrafts.length) {
            const next = pendingImport.activityDrafts[nextIdx];
            setImportActivityIndex(nextIdx);
            setEditingActivityId(null);
            setActivityForm({
              activity_name: next.activity_name || '',
              description: next.description || '',
              start_time: isoToLocalInput(next.start_time),
              end_time: isoToLocalInput(next.end_time),
              location: next.location || '',
              latitude: next.latitude ?? null,
              longitude: next.longitude ?? null,
            });
            setIsActivityFormOpen(true);
            return;
          }
          clearPendingItinerary();
          setPendingImport(null);
          setImportActivityActive(false);
          setImportActivityIndex(0);
        }
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

  // --- NAVIGATION ---
  const handleNavigateToVenue = (event) => {
    if (event.latitude && event.longitude) {
      router.push(`/map?lat=${event.latitude}&lng=${event.longitude}&label=${encodeURIComponent(event.venue || event.location)}`);
    } else {
      router.push(`/map`);
    }
  };

  const handleNavigateItinerary = (event, activitiesList) => {
    const waypoints = [];

    if (event.latitude && event.longitude) {
      waypoints.push({
        lat: parseFloat(event.latitude),
        lng: parseFloat(event.longitude),
        label: event.venue || event.location || 'Event Venue'
      });
    }

    activitiesList.forEach(a => {
      if (a.location && a.location.trim()) {
        if (a.latitude && a.longitude) {
          waypoints.push({
            lat: parseFloat(a.latitude),
            lng: parseFloat(a.longitude),
            label: a.location,
            activityName: a.activity_name
          });
        } else {
          waypoints.push({ label: a.location, activityName: a.activity_name });
        }
      }
    });

    if (waypoints.length > 0) {
      router.push(`/map?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`);
    } else {
      router.push(`/map`);
    }
  };

  // --- 6. FILTER & SEARCH ---
  const filteredEvents = eventData.filter(event => {
    const matchesCategory = activeFilter === 'All Events' ||
      event.tags.some(tag => tag.label.toLowerCase().includes(activeFilter.toLowerCase()));
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || getEventStatus(event) === statusFilter.toLowerCase();
    return matchesCategory && matchesSearch && matchesStatus;
  });

  // --- 7. NEW CALENDAR LOGIC (date-fns & framer-motion) ---
  const handlePrevMonth = () => {
    setCalendarDirection(-1);
    setCalendarDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCalendarDirection(1);
    setCalendarDate(prev => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCalendarDirection(0);
    setCalendarDate(new Date());
  };

  const handleMonthDragEnd = (event, info) => {
    if (info.offset.x < -50) {
      handleNextMonth();
    } else if (info.offset.x > 50) {
      handlePrevMonth();
    }
  };

  const calVariants = {
    enter: (direction) => ({ x: direction > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction < 0 ? 100 : -100, opacity: 0 }),
  };

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

  const getEventCalendarDate = (event) => {
    return event.date || (event.start_datetime ? event.start_datetime.split('T')[0] : null);
  };

  const moveEventToDate = async (event, targetDate) => {
    const updateData = { date: targetDate };
    if (event.start_datetime) {
      const start = new Date(event.start_datetime);
      const [year, month, day] = targetDate.split('-').map(Number);
      const newStart = new Date(start);
      newStart.setFullYear(year, month - 1, day);
      updateData.start_datetime = newStart.toISOString();
    }
    if (event.end_datetime) {
      const end = new Date(event.end_datetime);
      const [year, month, day] = targetDate.split('-').map(Number);
      const newEnd = new Date(end);
      newEnd.setFullYear(year, month - 1, day);
      updateData.end_datetime = newEnd.toISOString();
    }

    const { data, error } = await supabase.from('events').update(updateData).eq('id', event.id).select();
    if (data && !error) {
      setEventData(prev => prev.map(ev => ev.id === event.id ? generateDynamicProps(data[0]) : ev));
    }
  };

  const handleDragStart = (eventId) => setDraggedEventId(eventId);
  const handleDragEnd = () => { setDraggedEventId(null); setDragOverDate(null); };

  const handleDropOnDate = async (dateStr) => {
    if (!draggedEventId) return;
    const event = eventData.find(ev => String(ev.id) === String(draggedEventId));
    if (!event) return;
    const currentDateStr = getEventCalendarDate(event);
    if (currentDateStr === dateStr) {
      handleDragEnd();
      return;
    }
    await moveEventToDate(event, dateStr);
    handleDragEnd();
  };

  const getCalendarConflictEventIds = () => {
    const conflictIds = new Set();
    const grouped = {};

    eventData.forEach(event => {
      const date = getEventCalendarDate(event);
      if (!date) return;
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(event);
    });

    Object.values(grouped).forEach(events => {
      const sorted = [...events].sort((a, b) => {
        const aTime = a.start_datetime ? new Date(a.start_datetime) : new Date(`${getEventCalendarDate(a)}T00:00:00`);
        const bTime = b.start_datetime ? new Date(b.start_datetime) : new Date(`${getEventCalendarDate(b)}T00:00:00`);
        return aTime - bTime;
      });

      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        const aStart = a.start_datetime ? new Date(a.start_datetime) : new Date(`${getEventCalendarDate(a)}T00:00:00`);
        const aEnd = a.end_datetime ? new Date(a.end_datetime) : new Date(`${getEventCalendarDate(a)}T23:59:59`);

        for (let j = i + 1; j < sorted.length; j++) {
          const b = sorted[j];
          const bStart = b.start_datetime ? new Date(b.start_datetime) : new Date(`${getEventCalendarDate(b)}T00:00:00`);
          const bEnd = b.end_datetime ? new Date(b.end_datetime) : new Date(`${getEventCalendarDate(b)}T23:59:59`);

          if (aEnd > bStart && aStart < bEnd) {
            conflictIds.add(a.id);
            conflictIds.add(b.id);
          }
        }
      }
    });

    return conflictIds;
  };

  const calendarConflictEventIds = getCalendarConflictEventIds();
  const progressPercent = getProgressPercent();

  const renderCalendarCells = () => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const cellDays = [];
    let day = startDate;

    while (day <= endDate) {
      const cloneDay = day;
      const dateStr = format(cloneDay, 'yyyy-MM-dd');
      const dayEvents = eventData.filter(e => getEventCalendarDate(e) === dateStr);
      const hasEvent = dayEvents.length > 0;
      const hasConflict = dayEvents.some(ev => calendarConflictEventIds.has(ev.id));
      const isCurrentMonth = isSameMonth(cloneDay, monthStart);
      const isCurrentDay = isToday(cloneDay); 

      cellDays.push(
        <div
          key={cloneDay.toString()}
          className={styles.calCell}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDropOnDate(dateStr); }}
          onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
          onDragLeave={() => setDragOverDate(null)}
          style={{
            opacity: isCurrentMonth ? 1 : 0.4,
            backgroundColor: dragOverDate === dateStr 
              ? 'rgba(118, 181, 217, 0.2)' 
              : hasConflict 
                ? 'rgba(248, 113, 113, 0.12)' 
                : hasEvent 
                  ? 'rgba(94, 224, 147, 0.1)' 
                  : '#1a1a1a',
            border: dragOverDate === dateStr 
              ? '2px dashed #76b5d9' 
              : hasConflict 
                ? '1px solid #EF4444' 
                : hasEvent 
                  ? '1px solid #5EE093' 
                  : 'none'
          }}
        >
          <span 
            className={styles.calDayNum} 
            style={isCurrentDay ? {
              backgroundColor: '#10B981', 
              color: 'white',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              margin: '0 auto 6px auto'
            } : hasEvent ? { fontWeight: 'bold', color: '#76b5d9' } : {}}
          >
            {format(cloneDay, 'd')}
          </span>
          <div className={styles.calEventsContainer}>
            {dayEvents.map(ev => {
              const eventTime = ev.start_datetime ? formatTime(ev.start_datetime) : 'All Day';
              const isConflict = calendarConflictEventIds.has(ev.id);
              return (
                <div
                  key={ev.id}
                  className={styles.calEventPill}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('text/plain', ev.id); handleDragStart(ev.id); }}
                  onDragEnd={handleDragEnd}
                  style={{
                    backgroundColor: isConflict ? '#EF4444' : ev.typeColor,
                    color: isConflict ? '#fff' : '#111',
                    border: isConflict ? '1px solid #DC2626' : undefined,
                    cursor: 'grab'
                  }}
                  title={`Drag to move event to another day`}
                >
                  {eventTime} · {ev.title}
                </div>
              );
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    return cellDays;
  };

  return (
    <div className={styles.appContainer}>

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

        {pendingImport ? (
          <section
            style={{
              marginBottom: '14px',
              padding: '14px 16px',
              borderRadius: '14px',
              border: '1px solid rgba(37, 99, 235, 0.25)',
              background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.95), rgba(255, 255, 255, 0.98))',
              boxShadow: '0 8px 24px rgba(37, 99, 235, 0.08)',
            }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '15px', color: '#1e3a8a', fontWeight: 700 }}>
                  Itinerary from home demo
                </h2>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#475569', lineHeight: 1.55, maxWidth: '62ch' }}>
                  {pendingImport.prompt ? (
                    <>
                      <strong>Prompt:</strong> {pendingImport.prompt}
                      <br />
                    </>
                  ) : null}
                  {pendingImport.structured?.summary ? (
                    <>
                      <strong>Summary:</strong> {pendingImport.structured.summary}
                      <br />
                    </>
                  ) : null}
                  Create <strong>one event</strong> for this itinerary, then add <strong>{pendingImport.activityDrafts.length}</strong> places
                  as activities inside that event.
                </p>
                {importError ? (
                  <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#b91c1c', fontWeight: 600 }}>{importError}</p>
                ) : null}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleStartImportItinerary}
                  style={{
                    border: 'none',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: '#2563eb',
                    color: '#fff',
                  }}
                >
                  Create itinerary event
                </button>
                <button
                  type="button"
                  onClick={handleDismissPendingImport}
                  style={{
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: '#fff',
                    color: '#334155',
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
            <ul style={{ margin: '12px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#334155', lineHeight: 1.5 }}>
              {pendingImport.activityDrafts.slice(0, 6).map((a, i) => (
                <li key={`${a.activity_name}-${i}`}>
                  {new Date(a.start_time).toLocaleString()} — {a.activity_name} @ {a.location}
                </li>
              ))}
              {pendingImport.activityDrafts.length > 6 ? <li>…and {pendingImport.activityDrafts.length - 6} more</li> : null}
            </ul>
          </section>
        ) : null}

        {/* Status Filter Tabs */}
        <div className={styles.statusFilterBar}>
          {['All', 'Upcoming', 'Done'].map(status => (
            <button
              key={status}
              className={`${styles.statusBtn} ${statusFilter === status ? styles.statusBtnActive : ''}`}
              onClick={() => setStatusFilter(status)}
            >
              {status === 'Upcoming' && '🔜'} {status === 'Done' && '✅'} {status}
              <span className={styles.statusCount}>{statusCounts[status]}</span>
            </button>
          ))}
        </div>

        {/* Filter Bar */}
        <div className={styles.filterBar}>
          {/* Category dropdown */}
          <div className={styles.filterDropdownMobile}>
            <select
              className={styles.mobileSelect}
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

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
                borderRadius: '12px', padding: '12px 14px', position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span style={{ fontSize: '16px' }}>{s.icon}</span>
                  <strong style={{ fontSize: '13px', color: '#2d3748' }}>{s.title}</strong>
                  <button onClick={() => dismissSuggestion(i)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: '14px' }}>✕</button>
                </div>
                <div style={{ fontSize: '12.5px', color: '#4a5568', lineHeight: 1.6, whiteSpace: 'pre-line' }}>{s.message}</div>
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

        {/* Event List */}
        {loading ? (
            <div className="spinner-container">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            <section className={styles.eventList}>
          {filteredEvents.length === 0 ? (
            <div className={styles.emptyState}>
              {statusFilter === 'Done' ? 'No completed events yet.' : statusFilter === 'Upcoming' ? 'No upcoming events. Click "Add" to create one!' : 'No events found. Click "Add" to create one!'}
            </div>
          ) : (
            filteredEvents.map(event => {
              const status = getEventStatus(event);
              return (
                <div key={event.id} className={styles.eventCard} style={{
                  position: 'relative',
                  backgroundImage: `url(${event.image_link})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }} 
                onClick={() => handleOpenItinerary(event)}>
                  <span>
                    <div className={styles.titleContainer}>
                      <p>{event.title}</p>
                    </div>
                  </span>

                  {/* Status Badge */}
                  <span
                    className={styles.cardStatusBadge}
                    style={{
                      background: status === 'done' ? '#D1F2E0' : '#D5EAF9',
                      color: status === 'done' ? '#15A862' : '#4396D1',
                      border: '0.5px solid black'
                    }}
                  >
                    {status === 'done' ? 'Done' : 'Upcoming'}
                  </span>

                  {/* Conditionally Render Edit/Delete Actions */}
                  {isEditListMode && (
                    <div className={styles.cardActions}>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditForm(event)
                      }} className={styles.iconBtnEdit}>✎</button>
                      <button onClick={() => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id)
                        }} className={styles.iconBtnDelete}>🗑</button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
          )
        }
      </main>

      {/* --- ADD / EDIT EVENT MODAL --- */}
      {isFormOpen && (
        <div className={styles.modalOverlay} onClick={closeEventForm}>
          <div className={styles.formModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.formHeader}>
              <h2>
                {editingId
                  ? 'Edit Event'
                  : importItineraryActive && pendingImport?.activityDrafts?.length
                    ? `Create itinerary event (then ${pendingImport.activityDrafts.length} activities)`
                    : 'Create New Event'}
              </h2>
              <button type="button" className={styles.closeBtnLight} onClick={closeEventForm}>✕</button>
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
                          📍 {loc.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.latitude && formData.longitude && (
                    <div style={{ fontSize: '10px', color: '#15A862', marginTop: '4px', fontWeight: 600 }}>
                      ✅ Coordinates captured — navigation enabled
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={openMapPickerForEvent}
                    style={{
                      marginTop: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid #2C5282',
                      background: 'white',
                      color: '#2C5282',
                      cursor: 'pointer',
                    }}
                  >
                    🗺️ Pick on map
                  </button>
                </div>
                <div className={styles.formGroup}>
                  <label>Price / Cost</label>
                  <input required type="text" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} placeholder="e.g. ₱350/Person" />
                </div>
              </div>

              {/* SPLIT DATE AND TIME FOR REACT-TIMEKEEPER CLOCK UI */}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Start Date & Time</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="date" 
                      style={{ flex: 1.5 }}
                      value={getDatePart(formData.start_datetime)} 
                      onChange={e => {
                        const timePart = getTimePart(formData.start_datetime);
                        const newVal = e.target.value ? `${e.target.value}T${timePart}` : '';
                        setFormData({ ...formData, start_datetime: newVal, date: e.target.value || formData.date });
                      }} 
                    />
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        readOnly
                        style={{ width: '100%', paddingLeft: '32px', cursor: 'pointer' }}
                        value={formatDisplayTime(getTimePart(formData.start_datetime))} 
                        onClick={() => setShowEventStartClock(true)}
                        placeholder="Time"
                      />
                      <Clock size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      
                      {/* React Timekeeper Popup */}
                      {showEventStartClock && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowEventStartClock(false)} />
                          <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                            <TimeKeeper 
                              time={getTimePart(formData.start_datetime)}
                              onChange={(data) => {
                                const datePart = getDatePart(formData.start_datetime);
                                setFormData({ ...formData, start_datetime: `${datePart}T${data.formatted24}` });
                              }}
                              onDoneClick={() => setShowEventStartClock(false)}
                              switchToMinuteOnHourSelect
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>End Date & Time</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input 
                      type="date" 
                      style={{ flex: 1.5 }}
                      value={getDatePart(formData.end_datetime)} 
                      onChange={e => {
                        const timePart = getTimePart(formData.end_datetime);
                        const newVal = e.target.value ? `${e.target.value}T${timePart}` : '';
                        setFormData({ ...formData, end_datetime: newVal });
                      }} 
                    />
                    <div style={{ position: 'relative', flex: 1 }}>
                      <input 
                        type="text" 
                        readOnly
                        style={{ width: '100%', paddingLeft: '32px', cursor: 'pointer' }}
                        value={formatDisplayTime(getTimePart(formData.end_datetime))} 
                        onClick={() => setShowEventEndClock(true)}
                        placeholder="Time"
                      />
                      <Clock size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                      
                      {/* React Timekeeper Popup */}
                      {showEventEndClock && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowEventEndClock(false)} />
                          <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                            <TimeKeeper 
                              time={getTimePart(formData.end_datetime)}
                              onChange={(data) => {
                                const datePart = getDatePart(formData.end_datetime) || getDatePart(formData.start_datetime);
                                setFormData({ ...formData, end_datetime: `${datePart}T${data.formatted24}` });
                              }}
                              onDoneClick={() => setShowEventEndClock(false)}
                              switchToMinuteOnHourSelect
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
                    {formCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              {/* Validation Error */}
              {formError && (
                <div style={{
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '10px',
                  color: '#DC2626',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  animation: 'modalPopUp 0.2s ease'
                }}>
                  {formError}
                </div>
              )}

              <div className={styles.formFooter}>
                <button type="button" className={styles.btnCancel} onClick={closeEventForm}>Cancel</button>
                <button type="submit" className={styles.btnSave}>
                  {editingId
                    ? 'Save Changes'
                    : importItineraryActive && pendingImport?.activityDrafts?.length
                      ? 'Create itinerary & start activities'
                      : 'Create Event'}
                </button>
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
            <div key={event.id} style={{
              position: 'relative',
              backgroundImage: `url(${selectedEventForItinerary.image_link})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              width: '100%',
              height: '400px'
            }} >
              <button className={styles.itineraryCloseBtn} onClick={() => setIsItineraryOpen(false)}>✕</button>
            </div>

            {/* Body — Progress Bar + Timeline */}
            <div className={styles.itineraryBody}>
              <div className={styles.itineraryHeaderContent}>
                <div className={styles.itineraryHeaderTop}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                      Event Itinerary
                    </div>
                    <h2>{selectedEventForItinerary.title}</h2>
                  </div>
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

                  {selectedEventForItinerary.location && (
                    <div
                      className={styles.venueInfoItem}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (selectedEventForItinerary.latitude && selectedEventForItinerary.longitude) {
                          router.push(`/map?lat=${selectedEventForItinerary.latitude}&lng=${selectedEventForItinerary.longitude}&label=${encodeURIComponent(selectedEventForItinerary.location)}`);
                        } else {
                          router.push(`/map?label=${encodeURIComponent(selectedEventForItinerary.location)}`);
                        }
                      }}
                      title="Navigate to this address"
                    >
                      <span className={styles.infoIcon}>📍</span>
                      <div>
                        <span className={styles.infoLabel}>Address</span>
                        <span className={styles.infoValue}>{selectedEventForItinerary.location} <span style={{ fontSize: '10px', opacity: 0.7 }}>→ Navigate</span></span>
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
                            <span className={styles.infoLabel}>Date & Time</span>
                            <span className={styles.infoValue}>{range.dateStr}</span>
                            <span className={styles.infoValue}>{range.startTime}{range.endTime ? ` - ${range.endTime}` : ''}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Progress Bar */}
              {activities.length > 0 && (
                <div className={styles.progressContainer}>
                  <div className={styles.progressHeader}>
                    <span className={styles.progressLabel}>
                      {activities.filter(a => completedActivities[a.id]).length} of {activities.length} activities completed
                    </span>
                    <span className={styles.progressPercent}>{progressPercent}%</span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={`${styles.progressFill} ${progressPercent === 100 ? styles.progressComplete : ''}`}
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {activities.length === 0 && !isActivityFormOpen ? (
                <div className={styles.emptyItinerary}>
                  <span className={styles.emptyIcon}>📋</span>
                  <p>No activities yet</p>
                  <span>Add activities to build your event itinerary</span>
                </div>
              ) : (
                <div className={styles.timeline}>
                  {activities.map((activity, idx) => {
                    const isDone = !!completedActivities[activity.id];
                    return (
                      <div key={activity.id} className={styles.timelineItem} style={{ animationDelay: `${idx * 0.05}s` }}>
                        <div className={styles.timelineDot} style={isDone ? { background: '#15A862', boxShadow: '0 0 0 2px #15A862' } : {}}></div>
                        <div className={`${styles.activityCard} ${isDone ? styles.activityDone : ''}`}>
                          <div className={styles.activityCheckRow}>
                            <div
                              className={`${styles.activityCheckbox} ${isDone ? styles.activityChecked : ''}`}
                              onClick={() => toggleActivityComplete(activity.id)}
                              title={isDone ? 'Mark as incomplete' : 'Mark as complete'}
                            ></div>
                            <div style={{ flex: 1 }}>
                              <div className={styles.activityTime}>
                                <span className={styles.timeBadge}>{formatTime(activity.start_time)}</span>
                                <span>→</span>
                                <span className={styles.timeBadge}>{formatTime(activity.end_time)}</span>
                              </div>
                              <div className={styles.activityName}>{activity.activity_name}</div>
                            </div>
                          </div>
                          {activity.description && (
                            <div className={styles.activityDesc}>{activity.description}</div>
                          )}
                          {activity.location && (
                            <div
                              className={styles.activityLocation}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (activity.latitude && activity.longitude) {
                                  router.push(`/map?lat=${activity.latitude}&lng=${activity.longitude}&label=${encodeURIComponent(activity.location)}`);
                                } else {
                                  router.push(`/map?label=${encodeURIComponent(activity.location)}`);
                                }
                              }}
                              title="Navigate to this location"
                            >📍 {activity.location} <span style={{ fontSize: '10px', opacity: 0.7 }}>→ Navigate</span></div>
                          )}
                          <div className={styles.activityActions}>
                            <button onClick={() => handleOpenActivityForm(activity)}>✎ Edit</button>
                            <button className={styles.deleteActBtn} onClick={() => handleDeleteActivity(activity.id)}>🗑 Delete</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
                        <input required type="text" value={activityForm.activity_name} onChange={e => setActivityForm({ ...activityForm, activity_name: e.target.value })} placeholder="e.g. Opening Speech" />
                      </div>
                      
                      {/* SPLIT DATE AND TIME FOR REACT-TIMEKEEPER CLOCK UI ON ACTIVITIES */}
                      <div>
                        <label>Start *</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            required 
                            type="date" 
                            style={{ flex: 1.5 }}
                            value={getDatePart(activityForm.start_time)} 
                            onChange={e => {
                              const timePart = getTimePart(activityForm.start_time);
                              setActivityForm({ ...activityForm, start_time: `${e.target.value}T${timePart}` });
                            }} 
                            min={selectedEventForItinerary?.start_datetime?.split('T')[0]} 
                            max={selectedEventForItinerary?.end_datetime?.split('T')[0]} 
                          />
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input 
                              required 
                              type="text" 
                              readOnly
                              style={{ width: '100%', paddingLeft: '32px', cursor: 'pointer' }}
                              value={formatDisplayTime(getTimePart(activityForm.start_time))} 
                              onClick={() => setShowActStartClock(true)}
                              placeholder="Time"
                            />
                            <Clock size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                            
                            {/* React Timekeeper Popup */}
                            {showActStartClock && (
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowActStartClock(false)} />
                                <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                                  <TimeKeeper 
                                    time={getTimePart(activityForm.start_time)}
                                    onChange={(data) => {
                                      const datePart = getDatePart(activityForm.start_time) || (selectedEventForItinerary?.start_datetime?.split('T')[0] || new Date().toISOString().split('T')[0]);
                                      setActivityForm({ ...activityForm, start_time: `${datePart}T${data.formatted24}` });
                                    }}
                                    onDoneClick={() => setShowActStartClock(false)}
                                    switchToMinuteOnHourSelect
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label>End *</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input 
                            required 
                            type="date" 
                            style={{ flex: 1.5 }}
                            value={getDatePart(activityForm.end_time)} 
                            onChange={e => {
                              const timePart = getTimePart(activityForm.end_time);
                              setActivityForm({ ...activityForm, end_time: `${e.target.value}T${timePart}` });
                            }} 
                            min={getDatePart(activityForm.start_time) || selectedEventForItinerary?.start_datetime?.split('T')[0]} 
                            max={selectedEventForItinerary?.end_datetime?.split('T')[0]} 
                          />
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input 
                              required 
                              type="text" 
                              readOnly
                              style={{ width: '100%', paddingLeft: '32px', cursor: 'pointer' }}
                              value={formatDisplayTime(getTimePart(activityForm.end_time))} 
                              onClick={() => setShowActEndClock(true)}
                              placeholder="Time"
                            />
                            <Clock size={16} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                            
                            {/* React Timekeeper Popup */}
                            {showActEndClock && (
                              <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowActEndClock(false)} />
                                <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                                  <TimeKeeper 
                                    time={getTimePart(activityForm.end_time)}
                                    onChange={(data) => {
                                      const datePart = getDatePart(activityForm.end_time) || (getDatePart(activityForm.start_time) || (selectedEventForItinerary?.start_datetime?.split('T')[0] || new Date().toISOString().split('T')[0]));
                                      setActivityForm({ ...activityForm, end_time: `${datePart}T${data.formatted24}` });
                                    }}
                                    onDoneClick={() => setShowActEndClock(false)}
                                    switchToMinuteOnHourSelect
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={styles.fullWidth}>
                        <label>Description</label>
                        <textarea value={activityForm.description} onChange={e => setActivityForm({ ...activityForm, description: e.target.value })} placeholder="Brief description of the activity..." />
                      </div>
                      <div className={styles.fullWidth} style={{ position: 'relative' }}>
                        <label>Location</label>
                        <input type="text" value={activityForm.location} onChange={e => handleActivityLocationSearch(e.target.value)} placeholder="e.g. Main Hall, Room 201" />
                        {activityLocationResults.length > 0 && (
                          <div className={styles.autocompleteDropdown} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #ddd', zIndex: 10, maxHeight: '150px', overflowY: 'auto', borderRadius: '4px' }}>
                            {activityLocationResults.map((loc, i) => (
                              <div key={i} onClick={() => handleSelectActivityLocation(loc)} style={{ padding: '8px', cursor: 'pointer', borderBottom: '1px solid #eee', color: 'black', fontSize: '12px' }}>
                                📍 {loc.display_name}
                              </div>
                            ))}
                          </div>
                        )}
                        {activityForm.latitude && activityForm.longitude && (
                          <div style={{ fontSize: '10px', color: '#15A862', marginTop: '4px', fontWeight: 600 }}>
                            ✅ Coordinates captured — navigation enabled
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={openMapPickerForActivity}
                          style={{
                            marginTop: '8px',
                            padding: '6px 12px',
                            fontSize: '12px',
                            fontWeight: 600,
                            borderRadius: '8px',
                            border: '1px solid #2C5282',
                            background: 'white',
                            color: '#2C5282',
                            cursor: 'pointer',
                          }}
                        >
                          🗺️ Pick on map
                        </button>
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
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className={styles.navigateBtnLg}
                  style={{ background: 'linear-gradient(135deg, #4A90D9, #6D7DB9)' }}
                  onClick={() => { setSelectedEventForShare(selectedEventForItinerary); setIsShareModalOpen(true); }}
                >
                  🔗 Share Itinerary
                </button>
                <button
                  className={styles.navigateBtnLg}
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                  onClick={() => { setSelectedEventForBudget(selectedEventForItinerary); setIsBudgetOpen(true); }}
                >
                  💰 Budget
                </button>
                {(selectedEventForItinerary.latitude && selectedEventForItinerary.longitude) && (
                  <button className={styles.navigateBtnLg} onClick={() => handleNavigateToVenue(selectedEventForItinerary)}>
                    🧭 Navigate to Venue
                  </button>
                )}
                {activities.length > 0 && (
                  <button
                    className={styles.navigateBtnLg}
                    style={{ background: 'linear-gradient(135deg, #6D7DB9, #8B5CF6)' }}
                    onClick={() => handleNavigateItinerary(selectedEventForItinerary, activities)}
                  >
                    🗺️ Navigate Full Itinerary
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CALENDAR MODAL OVERLAY --- */}
      {isCalendarOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCalendarOpen(false)}>
          <div className={styles.calendarModal} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className={styles.calHeader}>
              <div className={styles.calHeaderLeft}>
                <button className={styles.calTodayBtn} onClick={handleToday}>Today</button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    onClick={handlePrevMonth} 
                    onDragEnter={(e) => { e.preventDefault(); handlePrevMonth(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <button 
                    onClick={handleNextMonth} 
                    onDragEnter={(e) => { e.preventDefault(); handleNextMonth(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '13px' }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
                <h2>{format(calendarDate, "MMMM yyyy")}</h2>
              </div>
              <div className={styles.calHeaderRight}>
                <button className={styles.calCloseBtn} onClick={() => setIsCalendarOpen(false)}>✕</button>
              </div>
            </div>

            {/* Weekdays */}
            <div className={styles.calWeekdays}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day}>{day}</div>)}
            </div>

            {/* Calendar Grid with Framer Motion Drag/Swipe */}
            <div style={{ overflow: 'hidden', position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <AnimatePresence initial={false} custom={calendarDirection} mode="popLayout">
                <motion.div
                  key={calendarDate.toString()}
                  custom={calendarDirection}
                  variants={calVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={1} 
                  onDragEnd={handleMonthDragEnd}
                  className={styles.calGrid}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', touchAction: 'pan-y' }}
                >
                  {renderCalendarCells()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}

      {/* --- SHARE MODAL --- */}
      {isShareModalOpen && selectedEventForShare && (
        <ShareModal
          event={selectedEventForShare}
          onClose={() => { setIsShareModalOpen(false); setSelectedEventForShare(null); }}
        />
      )}

      {/* --- BUDGET MODAL --- */}
      {isBudgetOpen && selectedEventForBudget && (
        <BudgetModal
          event={selectedEventForBudget}
          activities={activities}
          onClose={() => { setIsBudgetOpen(false); setSelectedEventForBudget(null); }}
        />
      )}
    </div>
  );
};

export default MyEvents;