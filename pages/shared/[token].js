import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { supabase } from '../../lib/supabaseClient';
import styles from '../../styles/share.module.css';
import eventStyles from '../../styles/event.module.css';

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
  const [activityForm, setActivityForm] = useState(initialActivityForm);
  const [editingActivityId, setEditingActivityId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [isLive, setIsLive] = useState(false);

  const isEditRole = data?.share?.role === 'edit';

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
      await supabase.from('share_collaborators').insert([{
        share_id: data.share.id,
        guest_label: guestName.trim(),
      }]);
    } catch { /* ignore */ }
  };

  // Navigation
  const handleNavigateToVenue = () => {
    const ev = data?.event;
    if (!ev) return;
    if (ev.latitude && ev.longitude) {
      router.push(`/map?lat=${ev.latitude}&lng=${ev.longitude}&label=${encodeURIComponent(ev.venue || ev.location || 'Venue')}`);
    } else if (ev.location) {
      router.push(`/map?label=${encodeURIComponent(ev.location)}`);
    }
  };

  const handleNavigateFullItinerary = () => {
    const ev = data?.event;
    if (!ev) return;
    const waypoints = [];
    if (ev.latitude && ev.longitude) {
      waypoints.push({ lat: parseFloat(ev.latitude), lng: parseFloat(ev.longitude), label: ev.venue || ev.location || 'Venue' });
    }
    activities.forEach(a => {
      if (a.location) waypoints.push({ label: a.location, activityName: a.activity_name });
    });
    if (waypoints.length > 0) {
      router.push(`/map?waypoints=${encodeURIComponent(JSON.stringify(waypoints))}`);
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
      });
      setEditingActivityId(activity.id);
    } else {
      setActivityForm(initialActivityForm);
      setEditingActivityId(null);
    }
    setFormError('');
    setIsActivityFormOpen(true);
  };

  const handleSaveActivity = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFormError('');
    try {
      const method = editingActivityId ? 'PUT' : 'POST';
      const body = {
        ...activityForm,
        start_time: new Date(activityForm.start_time).toISOString(),
        end_time: new Date(activityForm.end_time).toISOString(),
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
      setActivityForm(initialActivityForm);
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

  // --- Render states ---
  if (loading) {
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
            ✈️ ScheduleSkies
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
            <div className={styles.sharedEventHeader}>
              <div className={styles.sharedEventTag}>📅 Event Itinerary · Shared by {data.ownerName}</div>
              <h1 className={styles.sharedEventTitle}>{ev?.title}</h1>
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
          </div>

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
                              onClick={() => router.push(`/map?label=${encodeURIComponent(activity.location)}`)}
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
                          <input required type="datetime-local" value={activityForm.start_time}
                            onChange={e => setActivityForm({ ...activityForm, start_time: e.target.value })} />
                        </div>
                        <div>
                          <label>End Time *</label>
                          <input required type="datetime-local" value={activityForm.end_time}
                            onChange={e => setActivityForm({ ...activityForm, end_time: e.target.value })} />
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
                            onChange={e => setActivityForm({ ...activityForm, location: e.target.value })}
                            placeholder="e.g. Main Hall" />
                        </div>
                      </div>
                      {formError && (
                        <div style={{ color: '#DC2626', fontSize: '12px', margin: '8px 0', fontWeight: 600 }}>❌ {formError}</div>
                      )}
                      <div className={eventStyles.activityFormFooter}>
                        <button type="button" className={eventStyles.btnCancel}
                          onClick={() => { setIsActivityFormOpen(false); setEditingActivityId(null); setActivityForm(initialActivityForm); }}>
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
    </>
  );
}
