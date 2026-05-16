import React from 'react';
import styles from '@/styles/event.module.css';
import EventGalleryHeader from '@/components/EventGalleryHeader';
import TimeKeeper from 'react-timekeeper';
import { Clock } from 'lucide-react';

const ItineraryModal = ({
  isOpen, onClose, event, setEvent, userId, router,
  activities, completedActivities, progressPercent, toggleActivityComplete,
  formatTime, formatDateRange,
  isActivityFormOpen, setIsActivityFormOpen, handleOpenActivityForm,
  handleSaveActivity, handleDeleteActivity, editingActivityId, setEditingActivityId,
  activityForm, setActivityForm, initialActivityForm,
  activityLocationResults, handleActivityLocationSearch, handleSelectActivityLocation, openMapPickerForActivity,
  showActStartClock, setShowActStartClock, showActEndClock, setShowActEndClock,
  getDatePart, getTimePart, formatDisplayTime,
  onShare, onBudget, onNavigateVenue, onNavigateItinerary
}) => {
  if (!isOpen || !event) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.itineraryModal} onClick={(e) => e.stopPropagation()}>
        
        <EventGalleryHeader
          event={event}
          userId={userId}
          onClose={onClose}
          onCoverChange={(newUrl) => setEvent(prev => ({ ...prev, image_link: newUrl }))}
        />

        <div className={styles.itineraryBody}>
          <div className={styles.itineraryHeaderContent}>
            <div className={styles.itineraryHeaderTop}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Event Itinerary
                </div>
                <h2>{event.title}</h2>
                <span className={styles.activityCount}>{activities.length} ACTIVIT{activities.length === 1 ? 'Y' : 'IES'}</span>
              </div>
            </div>

            <div className={styles.venueInfoBar}>
              {event.venue && (
                <div className={styles.venueInfoItem}>
                  <span className={styles.infoIcon}>🏛️</span>
                  <div>
                    <span className={styles.infoLabel}>Venue</span>
                    <span className={styles.infoValue}>{event.venue}</span>
                  </div>
                </div>
              )}

              {event.location && (
                <div
                  className={styles.venueInfoItem}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    if (event.latitude && event.longitude) {
                      router.push(`/map?lat=${event.latitude}&lng=${event.longitude}&label=${encodeURIComponent(event.location)}`);
                    } else {
                      router.push(`/map?label=${encodeURIComponent(event.location)}`);
                    }
                  }}
                  title="Navigate to this address"
                >
                  <span className={styles.infoIcon}>📍</span>
                  <div>
                    <span className={styles.infoLabel}>Address</span>
                    <span className={styles.infoValue}>{event.location} <span style={{ fontSize: '10px', opacity: 0.7 }}>→ Navigate</span></span>
                  </div>
                </div>
              )}

              {event.start_datetime && (() => {
                const range = formatDateRange(event.start_datetime, event.end_datetime);
                return (
                  <div className={styles.venueInfoItem}>
                    <span className={styles.infoIcon}>📅</span>
                    <div>
                      <span className={styles.infoLabel}>Date & Time</span>
                      <span className={styles.infoValue}>{range.dateStr}</span>
                      <span className={styles.infoValue}>{range.startTime}{range.endTime ? ` - ${range.endTime}` : ''}</span>
                    </div>
                  </div>
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
                        min={event?.start_datetime?.split('T')[0]} 
                        max={event?.end_datetime?.split('T')[0]} 
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
                                onChange={(data) => {
                                  const datePart = getDatePart(activityForm.start_time) || (event?.start_datetime?.split('T')[0] || new Date().toISOString().split('T')[0]);
                                  const hh = String(data.hour).padStart(2, '0');
                                  const mm = String(data.minute).padStart(2, '0');
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
                        min={getDatePart(activityForm.start_time) || event?.start_datetime?.split('T')[0]} 
                        max={event?.end_datetime?.split('T')[0]} 
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
                                onChange={(data) => {
                                  const datePart = getDatePart(activityForm.end_time) || (getDatePart(activityForm.start_time) || (event?.start_datetime?.split('T')[0] || new Date().toISOString().split('T')[0]));
                                  const hh = String(data.hour).padStart(2, '0');
                                  const mm = String(data.minute).padStart(2, '0');
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
                        marginTop: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600,
                        borderRadius: '8px', border: '1px solid #2C5282', background: 'white', color: '#2C5282', cursor: 'pointer',
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

        <div className={styles.itineraryFooter}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className={styles.navigateBtnLg} style={{ background: 'linear-gradient(135deg, #4A90D9, #6D7DB9)' }} onClick={onShare}>
              🔗 Share Itinerary
            </button>
            <button className={styles.navigateBtnLg} style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }} onClick={onBudget}>
              💰 Budget
            </button>
            {(event.latitude && event.longitude) && (
              <button className={styles.navigateBtnLg} onClick={onNavigateVenue}>
                🧭 Navigate to Venue
              </button>
            )}
            {activities.length > 0 && (
              <button className={styles.navigateBtnLg} style={{ background: 'linear-gradient(135deg, #6D7DB9, #8B5CF6)' }} onClick={onNavigateItinerary}>
                🗺️ Navigate Full Itinerary
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryModal;