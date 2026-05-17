import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';
import TimeKeeper from 'react-timekeeper';
import { Clock } from 'lucide-react';
import styles from '../../styles/share.module.css';
import eventStyles from '../../styles/event.module.css';
import BudgetModal from '../../components/BudgetModal';
import SharedEventMapSection from '../../components/SharedEventMapSection';

const formatTime = (dtStr) => {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatDateRange = (start, end) => {
  if (!start) return { dateStr: '', startTime: '', endTime: '' };
  const s = new Date(start);
  const e = end ? new Date(end) : null;
  return {
    dateStr: s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    startTime: s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
    endTime: e ? e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '',
  };
};

const initialActivityForm = { activity_name: '', description: '', start_time: '', end_time: '', location: '' };
const MAP_PICK_SHARED_ACTIVITY_KEY = 'scheduleSkies_mapPick_shared-activity';
const SHARED_RESTORE_STORAGE_KEY = 'scheduleSkies_sharedRestore';

export default function SharedEventPage() {
  const router = useRouter();
  const { token } = router.query;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestSubmitted, setGuestSubmitted] = useState(false);
  const [activities, setActivities] = useState([]);
  const [completedActivities, setCompletedActivities] = useState({});
  const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
  const [activityForm, setActivityForm] = useState({ ...initialActivityForm, latitude: null, longitude: null });
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [showActStartClock, setShowActStartClock] = useState(false);
  const [showActEndClock, setShowActEndClock] = useState(false);
  const [locationResults, setLocationResults] = useState([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [signedInUser, setSignedInUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAddingToMyEvents, setIsAddingToMyEvents] = useState(false);
  const [addToMyEventsMsg, setAddToMyEventsMsg] = useState('');

  // Request edit access state
  const [accessRequestStatus, setAccessRequestStatus] = useState(null); // null | 'pending' | 'approved' | 'denied'
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [requestMsg, setRequestMsg] = useState('');

  // Budget state
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

  // Embedded map focus / pick mode
  const [mapFocus, setMapFocus] = useState(null);
  const [mapPickMode, setMapPickMode] = useState(false);
  const mapSectionRef = useRef(null);

  const isEditRole = data?.share?.role === 'edit';

  const scrollToMap = useCallback(() => {
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Fetch share data
  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/share/get?token=${token}`);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to load'); return; }
      setData(json);
      setActivities(json.activities || []);
    } catch {
      setError('Could not load this shared event.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSignedInUser(data?.session?.user || null);
        setAuthChecked(true);
      }
    });
    return () => { mounted = false; };
  }, []);

  // Auto-register signed-in users as collaborators so the event appears
  // in their "Shared with me" list on plan.js. Uses the /api/share/get
  // response (data.share.id) and the signed-in user's id.
  useEffect(() => {
    if (!signedInUser || !data?.share?.id || !data?.event?.user_id) return;
    // Don't register the owner as a collaborator on their own event
    if (signedInUser.id === data.event.user_id) return;

    const autoRegister = async () => {
      try {
        const { data: existing } = await supabase
          .from('share_collaborators')
          .select('id')
          .eq('share_id', data.share.id)
          .eq('user_id', signedInUser.id)
          .maybeSingle();

        if (!existing) {
          const displayName =
            signedInUser.user_metadata?.full_name ||
            signedInUser.email?.split('@')[0] ||
            'Collaborator';
          await supabase.from('share_collaborators').insert([{
            share_id: data.share.id,
            user_id: signedInUser.id,
            guest_label: displayName,
          }]);
        }
        // If they're signed in, skip the guest name prompt
        setGuestSubmitted(true);
      } catch (err) {
        console.error('Auto-register collaborator error:', err);
      }
    };
    autoRegister();
  }, [signedInUser, data?.share?.id, data?.event?.user_id]);

  useEffect(() => {
    if (typeof window === 'undefined' || !token) return;
    const restoreRaw = sessionStorage.getItem(SHARED_RESTORE_STORAGE_KEY);
    const pickNewRaw = sessionStorage.getItem(MAP_PICK_SHARED_ACTIVITY_KEY);
    const pickLegacyRaw = sessionStorage.getItem('scheduleSkies_mapPick');
    if (!restoreRaw && !pickNewRaw && !pickLegacyRaw) return;

    if (restoreRaw) {
      try {
        const restore = JSON.parse(restoreRaw);
        if (restore?.type === 'shared-activity' && restore?.token === token) {
          setActivityForm(restore.activityFormSnapshot || { ...initialActivityForm, latitude: null, longitude: null });
          setEditingActivityId(restore.editingActivityId ?? null);
          setIsActivityFormOpen(true);
          sessionStorage.removeItem(SHARED_RESTORE_STORAGE_KEY);
        }
      } catch {
        sessionStorage.removeItem(SHARED_RESTORE_STORAGE_KEY);
      }
    }

    const consumePick = (raw, storageKey) => {
      if (!raw) return;
      try {
        const pick = JSON.parse(raw);
        if (Date.now() - pick.ts > 10 * 60 * 1000) {
          sessionStorage.removeItem(storageKey);
          return;
        }
        const ok =
          pick.context === 'shared-activity' ||
          (storageKey === 'scheduleSkies_mapPick' && pick.context === 'activity');
        if (ok) {
          setActivityForm(prev => ({
            ...prev,
            location: pick.label || prev.location,
            latitude: pick.lat,
            longitude: pick.lng,
          }));
          setIsActivityFormOpen(true);
          sessionStorage.removeItem(storageKey);
        }
      } catch {
        sessionStorage.removeItem(storageKey);
      }
    };

    consumePick(pickNewRaw, MAP_PICK_SHARED_ACTIVITY_KEY);
    consumePick(pickLegacyRaw, 'scheduleSkies_mapPick');
  }, [token]);

  // Real-time subscription
  useEffect(() => {
    if (!data?.event?.id) return;
    const eventId = data.event.id;
    const channel = supabase
      .channel(`shared-itinerary-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'itinerary_activities',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        setActivities(prev => {
          if (prev.find(a => a.id === payload.new.id)) return prev;
          return [...prev, payload.new].sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'itinerary_activities',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        setActivities(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'itinerary_activities',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        setActivities(prev => prev.filter(a => a.id !== payload.old.id));
      })
      .subscribe((status) => {
        setIsLive(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [data?.event?.id]);

  // Progress tracking via localStorage
  useEffect(() => {
    if (!data?.event?.id) return;
    try {
      const stored = localStorage.getItem(`itinerary_progress_${data.event.id}`);
      if (stored) setCompletedActivities(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [data?.event?.id]);

  const toggleComplete = (activityId) => {
    if (!data?.event?.id) return;
    const updated = { ...completedActivities, [activityId]: !completedActivities[activityId] };
    setCompletedActivities(updated);
    try { localStorage.setItem(`itinerary_progress_${data.event.id}`, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  const progressPercent = activities.length === 0 ? 0
    : Math.round((activities.filter(a => completedActivities[a.id]).length / activities.length) * 100);

  // Guest join tracking
  const handleGuestSubmit = async () => {
    if (!guestName.trim()) return;
    setGuestSubmitted(true);
    if (!data?.share?.id) return;
    try {
      let currentUserId = null;
      const { data: sessionData } = await supabase.auth.getSession();
      currentUserId = sessionData?.session?.user?.id || null;

      if (currentUserId) {
        const { data: existing } = await supabase
          .from('share_collaborators')
          .select('id')
          .eq('share_id', data.share.id)
          .eq('user_id', currentUserId)
          .maybeSingle();

        if (!existing) {
          await supabase.from('share_collaborators').insert([{
            share_id: data.share.id,
            user_id: currentUserId,
            guest_label: guestName.trim(),
          }]);
        }
      } else {
        await supabase.from('share_collaborators').insert([{
          share_id: data.share.id,
          guest_label: guestName.trim(),
        }]);
      }
    } catch { /* ignore */ }
  };

  const getTimePart = (dt) => dt && dt.includes('T') ? dt.split('T')[1].substring(0, 5) : '12:00';
  const getDatePart = (dt) => dt && dt.includes('T') ? dt.split('T')[0] : new Date().toISOString().split('T')[0];
  const formatDisplayTime = (time24) => {
    if (!time24) return '';
    const [h, m] = time24.split(':');
    const hours = parseInt(h, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${m} ${ampm}`;
  };

  const handleActivityLocationSearch = async (val) => {
    setActivityForm({ ...activityForm, location: val });
    if (val.length > 2) {
      setIsSearchingLocation(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`);
        const locData = await res.json();
        setLocationResults(locData || []);
      } catch {
        setLocationResults([]);
      } finally {
        setIsSearchingLocation(false);
      }
    } else {
      setLocationResults([]);
    }
  };

  const handleSelectActivityLocation = (loc) => {
    const lat = loc?.lat != null ? parseFloat(loc.lat) : null;
    const lng = loc?.lon != null ? parseFloat(loc.lon) : null;
    setActivityForm({
      ...activityForm,
      location: loc.display_name || activityForm.location,
      latitude: Number.isNaN(lat) ? null : lat,
      longitude: Number.isNaN(lng) ? null : lng,
    });
    setLocationResults([]);
  };

  const openMapPickerForActivity = () => {
    setMapPickMode(true);
    scrollToMap();
  };

  const handleMapPickConfirm = (pick) => {
    setActivityForm(prev => ({
      ...prev,
      location: pick.label || prev.location,
      latitude: pick.lat,
      longitude: pick.lng,
    }));
    setMapPickMode(false);
    setIsActivityFormOpen(true);
  };

  const handleMapPickCancel = () => {
    setMapPickMode(false);
  };

  // In-page map navigation (no auth required)
  const handleNavigateToVenue = () => {
    if (!data?.event) return;
    setMapFocus({ type: 'venue' });
    scrollToMap();
  };

  const handleNavigateFullItinerary = () => {
    if (!data?.event) return;
    setMapFocus({ type: 'itinerary' });
    scrollToMap();
  };

  const handleNavigateToActivity = (activity) => {
    if (!activity?.location && !activity?.latitude) return;
    setMapFocus({ type: 'activity', activityId: activity.id });
    scrollToMap();
  };

  const handleAddToMyEvents = async () => {
    if (!signedInUser || !ev) return;
    setIsAddingToMyEvents(true);
    setAddToMyEventsMsg('');

    try {
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', signedInUser.id)
        .eq('title', ev.title || '')
        .eq('location', ev.location || '')
        .eq('start_datetime', ev.start_datetime || null)
        .eq('end_datetime', ev.end_datetime || null)
        .limit(1);

      let targetEventId = existing?.[0]?.id || null;

      if (!targetEventId) {
        const { data: insertedEvent, error: insertEventError } = await supabase
          .from('events')
          .insert([{
            title: ev.title || 'Shared Event',
            location: ev.location || '',
            price: ev.price || '',
            date: ev.date || (ev.start_datetime ? ev.start_datetime.split('T')[0] : new Date().toISOString().split('T')[0]),
            category: ev.category || 'Leisure',
            user_id: signedInUser.id,
            venue: ev.venue || null,
            start_datetime: ev.start_datetime || null,
            end_datetime: ev.end_datetime || null,
            latitude: ev.latitude || null,
            longitude: ev.longitude || null,
            image_link: ev.image_link || null,
          }])
          .select()
          .single();

        if (insertEventError || !insertedEvent) throw new Error('Failed to add event to your account.');
        targetEventId = insertedEvent.id;

        if (activities.length > 0) {
          const payload = activities.map((a, index) => ({
            event_id: targetEventId,
            user_id: signedInUser.id,
            activity_name: a.activity_name,
            description: a.description || null,
            start_time: a.start_time || null,
            end_time: a.end_time || null,
            location: a.location || null,
            latitude: a.latitude || null,
            longitude: a.longitude || null,
            sort_order: a.sort_order ?? index,
          }));
          await supabase.from('itinerary_activities').insert(payload);
        }

        setAddToMyEventsMsg('Added to your account. You can now view/edit it in My Events.');
      } else {
        setAddToMyEventsMsg('This shared event is already in your account.');
      }
    } catch (err) {
      setAddToMyEventsMsg(err.message || 'Unable to add this event right now.');
    } finally {
      setIsAddingToMyEvents(false);
    }
  };

  // Activity CRUD (edit role only)
  const handleOpenActivityForm = (activity = null) => {
    if (activity) {
      const toLocal = (s) => {
        if (!s) return '';
        const d = new Date(s);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setActivityForm({
        activity_name: activity.activity_name,
        description: activity.description || '',
        start_time: toLocal(activity.start_time),
        end_time: toLocal(activity.end_time),
        location: activity.location || '',
        latitude: activity.latitude || null,
        longitude: activity.longitude || null,
      });
      setEditingActivityId(activity.id);
    } else {
      setActivityForm({ ...initialActivityForm, latitude: null, longitude: null });
      setEditingActivityId(null);
    }
    setLocationResults([]);
    setFormError('');
    setIsActivityFormOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');
    try {
      const start = new Date(activityForm.start_time);
      const end = new Date(activityForm.end_time);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error('Please provide valid start and end date/time.');
      }
      if (end <= start) {
        throw new Error('End time must be after start time.');
      }

      const method = editingActivityId ? 'PUT' : 'POST';
      const body = {
        ...activityForm,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        ...(editingActivityId ? { id: editingActivityId } : {}),
      };
      const res = await fetch(`/api/share/activity?token=${token}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      if (!editingActivityId) {
        setActivities(prev => [...prev, json.activity].sort((a, b) => new Date(a.start_time) - new Date(b.start_time)));
      } else {
        setActivities(prev => prev.map(a => a.id === editingActivityId ? json.activity : a));
      }
      setIsActivityFormOpen(false);
      setEditingActivityId(null);
      setActivityForm({ ...initialActivityForm, latitude: null, longitude: null });
      setLocationResults([]);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteActivity = async (id) => {
    if (!confirm('Delete this activity?')) return;
    const res = await fetch(`/api/share/activity?token=${token}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) setActivities(prev => prev.filter(a => a.id !== id));
  };

  // --- Request edit access handler ---
  const handleRequestAccess = async () => {
    if (!data?.share?.id) return;
    setIsRequestingAccess(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      const session = (await supabase.auth.getSession())?.data?.session;
      if (session) headers['Authorization'] = `Bearer ${session.access_token}`;

      const displayName = signedInUser?.user_metadata?.full_name || signedInUser?.email?.split('@')[0] || 'A viewer';
      const res = await fetch('/api/share/request-access', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          share_id: data.share.id,
          requester_name: displayName,
          message: requestMsg || null,
        }),
      });
      const json = await res.json();
      if (res.ok) setAccessRequestStatus('pending');
      else console.error('Request access error:', json);
    } catch (err) {
      console.error('Request access error:', err);
    } finally {
      setIsRequestingAccess(false);
    }
  };

  // --- Render states ---
  if (loading || !authChecked) {
    return (
      <div className={styles.sharedPage}>
        <div className={styles.sharedLoading}>
          <div className={styles.spinner}></div>
          <p>Loading shared event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.sharedPage}>
        <div className={styles.sharedError}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>🔒</div>
          <h2>{error}</h2>
          <p>This link may be invalid, expired, or revoked.</p>
        </div>
      </div>
    );
  }

  // --- LOGIN GATE: Edit links require authentication ---
  if (isEditRole && !signedInUser) {
    return (
      <>
        <Head>
          <title>Sign in to Collaborate | ScheduleSkies</title>
        </Head>
        <div className={styles.sharedPage}>
          <nav className={styles.sharedNav}>
            <div className={styles.sharedNavBrand}>
              <img src="/images/logo.png" alt="ScheduleSkies logo" style={{ height: '36px', width: 'auto' }} />
              <span>ScheduleSkies</span>
            </div>
            <span className={styles.sharedNavBadge}>✏️ Collaborator Link</span>
          </nav>
          <div className={styles.sharedContent}>
            <div className={styles.loginGateCard}>
              <div style={{ fontSize: '56px', marginBottom: '16px' }}>🔐</div>
              <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 800, color: '#1e293b' }}>Sign in to Collaborate</h2>
              <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#64748b', lineHeight: 1.6 }}>
                This is an <strong>edit link</strong> — you need to sign in with your ScheduleSkies account to add or modify itineraries and budgets.
              </p>
              <button
                className={styles.loginGateBtn}
                onClick={() => router.push(`/login?returnTo=${encodeURIComponent(`/shared/${token}`)}`)}
              >
                🚀 Sign In to Continue
              </button>
              <p style={{ margin: '16px 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Don't have an account?{' '}
                <a href={`/signup?returnTo=${encodeURIComponent(`/shared/${token}`)}`} style={{ color: '#6D7DB9', fontWeight: 700, textDecoration: 'none' }}>Sign up here</a>
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const ev = data?.event;
  const range = ev?.start_datetime ? formatDateRange(ev.start_datetime, ev.end_datetime) : null;

  // Auth check — if user is logged-in auth is already handled. For guests (unauthenticated), show name prompt.
  const needsGuestName = isEditRole && !guestSubmitted;

  return (
    <>
      <Head>
        <title>{ev?.title || 'Shared Event'} | ScheduleSkies</title>
        <meta name="description" content={`View ${ev?.title} itinerary on ScheduleSkies`} />
      </Head>
      <div className={styles.sharedPage}>

        {/* Navbar */}
        <nav className={styles.sharedNav}>
          <div className={styles.sharedNavBrand}>
            <img src="/images/logo.png" alt="ScheduleSkies logo" style={{ height: '36px', width: 'auto' }} />
            <span>ScheduleSkies</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isLive && (
              <div className={styles.liveIndicator}>
                <div className={styles.liveDot}></div>
                Live
              </div>
            )}
            <span className={styles.sharedNavBadge}>
              {data.share.role === 'edit' ? '✏️ Collaborator' : '👁 Viewer'}
            </span>
          </div>
        </nav>

        <div className={styles.sharedContent}>

          {/* Guest name prompt */}
          {needsGuestName && (
            <div className={styles.guestPrompt}>
              <div className={styles.guestPromptTitle}>Welcome, Collaborator! 👋</div>
              <div className={styles.guestPromptSub}>Enter your name so the event owner knows who you are</div>
              <input
                className={styles.guestInput}
                type="text"
                placeholder="Your name..."
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGuestSubmit()}
              />
              <button className={styles.guestSubmitBtn} onClick={handleGuestSubmit} disabled={!guestName.trim()}>
                Join as Collaborator →
              </button>
            </div>
          )}

          {/* Event Card */}
          <div className={styles.sharedEventCard}>
            {ev?.image_link && (
              <img
                src={ev.image_link}
                alt={ev.title || 'Event'}
                className={styles.sharedEventCover}
              />
            )}
            <div className={styles.sharedEventHeader}>
              <div className={styles.sharedEventTag}>📅 Event Itinerary · Shared by {data.ownerName}</div>
              <h1 className={styles.sharedEventTitle}>{ev?.title}</h1>
              {ev?.category && (
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '12px' }}>
                  {ev.category}
                </div>
              )}
              <div className={styles.sharedInfoGrid}>
                {ev?.venue && (
                  <div className={styles.sharedInfoItem}>
                    <span className="icon">🏛️</span>
                    <div>
                      <span className="label">Venue</span>
                      <span className="value">{ev.venue}</span>
                    </div>
                  </div>
                )}
                {range?.dateStr && (
                  <div className={styles.sharedInfoItem}>
                    <span className="icon">📅</span>
                    <div>
                      <span className="label">Date</span>
                      <span className="value">{range.dateStr}</span>
                    </div>
                  </div>
                )}
                {range?.startTime && (
                  <div className={styles.sharedInfoItem}>
                    <span className="icon">🕐</span>
                    <div>
                      <span className="label">Time</span>
                      <span className="value">{range.startTime}{range.endTime ? ` — ${range.endTime}` : ''}</span>
                    </div>
                  </div>
                )}
                {ev?.location && (
                  <div
                    className={`${styles.sharedInfoItem} ${styles.clickable}`}
                    onClick={handleNavigateToVenue}
                    title="Click to navigate"
                  >
                    <span className="icon">📍</span>
                    <div>
                      <span className="label">Address · Tap to navigate</span>
                      <span className="value">{ev.location}</span>
                    </div>
                  </div>
                )}
                {ev?.price && (
                  <div className={styles.sharedInfoItem}>
                    <span className="icon">💰</span>
                    <div>
                      <span className="label">Cost</span>
                      <span className="value">{ev.price}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className={styles.sharedNavActions}>
            {(ev?.latitude || ev?.location) && (
              <button className={`${styles.navActionBtn} ${styles.navBtnPrimary}`} onClick={handleNavigateToVenue}>
                🧭 Navigate to Venue
              </button>
            )}
            {activities.length > 0 && (
              <button className={`${styles.navActionBtn} ${styles.navBtnSecondary}`} onClick={handleNavigateFullItinerary}>
                🗺️ Navigate Full Itinerary
              </button>
            )}
            {signedInUser && (
              <button className={`${styles.navActionBtn} ${styles.navBtnSecondary}`} onClick={handleAddToMyEvents} disabled={isAddingToMyEvents}>
                {isAddingToMyEvents ? '⏳ Adding...' : '➕ Add to My Events'}
              </button>
            )}
            {/* Budget button for signed-in users */}
            {signedInUser && ev && (
              <button className={`${styles.navActionBtn} ${styles.navBtnSecondary}`} onClick={() => setIsBudgetOpen(true)}>
                💰 Budget & Expenses
              </button>
            )}
          </div>
          {addToMyEventsMsg && (
            <div style={{ marginTop: '8px', fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>
              {addToMyEventsMsg}
            </div>
          )}

          {/* Embedded map — public, no login required */}
          <div ref={mapSectionRef}>
            <SharedEventMapSection
              event={ev}
              activities={activities}
              mapFocus={mapFocus}
              pickMode={mapPickMode}
              pickInitialCoords={
                activityForm.latitude != null && activityForm.longitude != null
                  ? { lat: activityForm.latitude, lng: activityForm.longitude }
                  : null
              }
              pickHintLabel={activityForm.location || ''}
              onPickConfirm={handleMapPickConfirm}
              onPickCancel={handleMapPickCancel}
            />
          </div>

          {/* Request Edit Access — shown to view-only signed-in users */}
          {!isEditRole && signedInUser && signedInUser.id !== data?.event?.user_id && (
            <div className={styles.requestAccessCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '20px' }}>✏️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>Want to add activities?</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>Request edit access from the event owner</div>
                </div>
              </div>
              {accessRequestStatus === 'pending' ? (
                <div style={{ padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#92400E' }}>
                  ⏳ Your request has been sent. Waiting for the owner to approve.
                </div>
              ) : accessRequestStatus === 'approved' ? (
                <div style={{ padding: '10px 14px', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#065F46' }}>
                  ✅ Approved!{' '}
                  <button
                    type="button"
                    onClick={() => fetchData()}
                    style={{ background: 'none', border: 'none', color: '#047857', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    Reload to start editing
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className={styles.guestInput}
                    style={{ marginBottom: 0, flex: 1 }}
                    placeholder="Optional message to owner..."
                    value={requestMsg}
                    onChange={e => setRequestMsg(e.target.value)}
                  />
                  <button
                    className={styles.requestAccessBtn}
                    onClick={handleRequestAccess}
                    disabled={isRequestingAccess}
                  >
                    {isRequestingAccess ? '⏳ Sending...' : '📨 Request Edit Access'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Activities / Timeline */}
          <div className={styles.sharedTimeline}>
            <div className={styles.sharedTimelineHeader}>
              <div className={styles.sharedTimelineTitle}>
                📋 Itinerary
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
                  {activities.length} activit{activities.length !== 1 ? 'ies' : 'y'}
                </span>
              </div>
              {isLive && (
                <div className={styles.liveIndicator}>
                  <div className={styles.liveDot}></div>
                  Live Updates
                </div>
              )}
            </div>
            <div className={styles.sharedTimelineBody}>

              {/* Progress bar */}
              {activities.length > 0 && (
                <div className={styles.sharedProgressContainer}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                      {activities.filter(a => completedActivities[a.id]).length} of {activities.length} completed
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#6D7DB9' }}>{progressPercent}%</span>
                  </div>
                  <div className={styles.sharedProgressBar}>
                    <div
                      className={`${styles.sharedProgressFill} ${progressPercent === 100 ? styles.sharedProgressComplete : ''}`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {activities.length === 0 && !isActivityFormOpen ? (
                <div className={styles.sharedEmptyActivities}>
                  <span className="emptyIcon">📋</span>
                  <p>No activities scheduled yet.</p>
                  {isEditRole && <p style={{ fontSize: '12px' }}>As a collaborator, you can add activities below.</p>}
                </div>
              ) : (
                <div className={eventStyles.timeline}>
                  {activities.map((activity, idx) => {
                    const isDone = !!completedActivities[activity.id];
                    return (
                      <div key={activity.id} className={eventStyles.timelineItem} style={{ animationDelay: `${idx * 0.04}s` }}>
                        <div className={eventStyles.timelineDot} style={isDone ? { background: '#15A862' } : {}}></div>
                        <div className={`${eventStyles.activityCard} ${isDone ? eventStyles.activityDone : ''}`}>
                          <div className={eventStyles.activityCheckRow}>
                            <div
                              className={`${eventStyles.activityCheckbox} ${isDone ? eventStyles.activityChecked : ''}`}
                              onClick={() => toggleComplete(activity.id)}
                              title={isDone ? 'Mark incomplete' : 'Mark complete'}
                            />
                            <div style={{ flex: 1 }}>
                              <div className={eventStyles.activityTime}>
                                <span className={eventStyles.timeBadge}>{formatTime(activity.start_time)}</span>
                                <span>→</span>
                                <span className={eventStyles.timeBadge}>{formatTime(activity.end_time)}</span>
                              </div>
                              <div className={eventStyles.activityName}>{activity.activity_name}</div>
                            </div>
                          </div>
                          {activity.description && <div className={eventStyles.activityDesc}>{activity.description}</div>}
                          {activity.location && (
                            <div
                              className={eventStyles.activityLocation}
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleNavigateToActivity(activity)}
                              title="Navigate to this location"
                            >
                              📍 {activity.location} <span style={{ fontSize: '10px', opacity: 0.7 }}>→ Navigate</span>
                            </div>
                          )}
                          {isEditRole && (
                            <div className={eventStyles.activityActions}>
                              <button onClick={() => handleOpenActivityForm(activity)}>✎ Edit</button>
                              <button className={eventStyles.deleteActBtn} onClick={() => handleDeleteActivity(activity.id)}>🗑 Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add activity form */}
              {isEditRole && (
                isActivityFormOpen ? (
                  <div className={eventStyles.activityFormCard} style={{ marginTop: '16px' }}>
                    <h4>{editingActivityId ? 'Edit Activity' : 'Add New Activity'}</h4>
                    <form onSubmit={handleSaveActivity}>
                      <div className={eventStyles.activityFormGrid}>
                        <div className={eventStyles.fullWidth}>
                          <label>Activity Name *</label>
                          <input required type="text" value={activityForm.activity_name}
                            onChange={e => setActivityForm({ ...activityForm, activity_name: e.target.value })}
                            placeholder="e.g. Opening Ceremony" />
                        </div>
                        <div>
                          <label>Start Time *</label>
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
                              {showActStartClock && (
                                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowActStartClock(false)} />
                                  <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                                    <TimeKeeper
                                      time={getTimePart(activityForm.start_time)}
                                      onChange={(clockData) => {
                                        const datePart = getDatePart(activityForm.start_time) || new Date().toISOString().split('T')[0];
                                        const hh = String(clockData.hour).padStart(2, '0');
                                        const mm = String(clockData.minute).padStart(2, '0');
                                        setActivityForm({ ...activityForm, start_time: `${datePart}T${hh}:${mm}` });
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
                          <label>End Time *</label>
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
                              {showActEndClock && (
                                <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowActEndClock(false)} />
                                  <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                                    <TimeKeeper
                                      time={getTimePart(activityForm.end_time)}
                                      onChange={(clockData) => {
                                        const datePart = getDatePart(activityForm.end_time) || getDatePart(activityForm.start_time) || new Date().toISOString().split('T')[0];
                                        const hh = String(clockData.hour).padStart(2, '0');
                                        const mm = String(clockData.minute).padStart(2, '0');
                                        setActivityForm({ ...activityForm, end_time: `${datePart}T${hh}:${mm}` });
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
                        <div className={eventStyles.fullWidth}>
                          <label>Description</label>
                          <textarea value={activityForm.description}
                            onChange={e => setActivityForm({ ...activityForm, description: e.target.value })}
                            placeholder="Brief description..." />
                        </div>
                        <div className={eventStyles.fullWidth}>
                          <label>Location</label>
                          <input type="text" value={activityForm.location}
                            onChange={e => handleActivityLocationSearch(e.target.value)}
                            placeholder="e.g. Main Hall" />
                          {activityForm.latitude && activityForm.longitude && (
                            <div style={{ fontSize: '10px', color: '#15A862', marginTop: '4px', fontWeight: 600 }}>
                              ✅ Coordinates captured — navigation enabled
                            </div>
                          )}
                          {isSearchingLocation && (
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Searching…</div>
                          )}
                          {locationResults.length > 0 && (
                            <div style={{ marginTop: '6px', border: '1px solid #e2e8f0', borderRadius: '8px', maxHeight: '140px', overflowY: 'auto', background: '#fff' }}>
                              {locationResults.map((loc, i) => (
                                <div
                                  key={`${loc.display_name}-${i}`}
                                  onClick={() => handleSelectActivityLocation(loc)}
                                  style={{ padding: '8px 10px', cursor: 'pointer', borderBottom: i < locationResults.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: '12px' }}
                                >
                                  📍 {loc.display_name}
                                </div>
                              ))}
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
                      {formError && (
                        <div style={{ color: '#DC2626', fontSize: '12px', margin: '8px 0', fontWeight: 600 }}>❌ {formError}</div>
                      )}
                      <div className={eventStyles.activityFormFooter}>
                        <button type="button" className={eventStyles.btnCancel}
                          onClick={() => { setIsActivityFormOpen(false); setEditingActivityId(null); setActivityForm({ ...initialActivityForm, latitude: null, longitude: null }); }}>
                          Cancel
                        </button>
                        <button type="submit" className={eventStyles.btnSave} disabled={isSaving}>
                          {isSaving ? 'Saving...' : editingActivityId ? 'Save Changes' : 'Add Activity'}
                        </button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button className={styles.addActivityBtnShared} onClick={() => handleOpenActivityForm()}>
                    ⊕ Add Activity
                  </button>
                )
              )}
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '32px', color: 'rgba(255,255,255,0.7)', fontSize: '12px' }}>
            Powered by <strong style={{ color: 'white' }}>ScheduleSkies</strong> · Event planning made collaborative
          </div>
        </div>
      </div>
      {/* Budget Modal */}
      {isBudgetOpen && ev && (
        <BudgetModal event={ev} activities={activities} onClose={() => setIsBudgetOpen(false)} />
      )}
    </>
  );
}
