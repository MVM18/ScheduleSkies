import React from 'react';
import styles from '@/styles/event.module.css';
import TimeKeeper from 'react-timekeeper';
import { Clock } from 'lucide-react';

const EventFormModal = ({
  isOpen, onClose, onSave, editingId, importItineraryActive, pendingImport,
  formData, setFormData, formError,
  locationResults, handleLocationSearch, handleSelectLocation, openMapPickerForEvent,
  showEventStartClock, setShowEventStartClock, showEventEndClock, setShowEventEndClock,
  formCategories, getDatePart, getTimePart, formatDisplayTime
}) => {
  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.formModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.formHeader}>
          <h2>
            {editingId
              ? 'Edit Event'
              : importItineraryActive && pendingImport?.activityDrafts?.length
                ? `Create itinerary event (then ${pendingImport.activityDrafts.length} activities)`
                : 'Create New Event'}
          </h2>
          <button type="button" className={styles.closeBtnLight} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={onSave} className={styles.eventForm}>
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
                  marginTop: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 600,
                  borderRadius: '8px', border: '1px solid #2C5282', background: 'white', color: '#2C5282', cursor: 'pointer',
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

          {formData.image_link && (
            <div style={{ marginTop: '8px', borderRadius: '10px', overflow: 'hidden', height: '120px', width: '100%', position: 'relative', border: '1px solid #e2e8f0' }}>
              <img src={formData.image_link} alt="Location preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 10px', background: 'rgba(0,0,0,0.5)', fontSize: '10px', color: '#fff', fontWeight: 500 }}>
                {formData.image_link.includes('unsplash') ? '🖼️ Placeholder image' : '📍 Location photo from Google'}
              </div>
            </div>
          )}

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
                  
                  {showEventStartClock && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowEventStartClock(false)} />
                      <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                        <TimeKeeper 
                          time={getTimePart(formData.start_datetime)}
                          onChange={(data) => {
                            const datePart = getDatePart(formData.start_datetime);
                            const hh = String(data.hour).padStart(2, '0');
                            const mm = String(data.minute).padStart(2, '0');
                            setFormData({ ...formData, start_datetime: `${datePart}T${hh}:${mm}` });
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
                  
                  {showEventEndClock && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={() => setShowEventEndClock(false)} />
                      <div style={{ position: 'relative', zIndex: 100000, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', borderRadius: '8px', background: 'white' }}>
                        <TimeKeeper 
                          time={getTimePart(formData.end_datetime)}
                          onChange={(data) => {
                            const datePart = getDatePart(formData.end_datetime) || getDatePart(formData.start_datetime);
                            const hh = String(data.hour).padStart(2, '0');
                            const mm = String(data.minute).padStart(2, '0');
                            setFormData({ ...formData, end_datetime: `${datePart}T${hh}:${mm}` });
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

          {formError && (
            <div style={{
              padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', color: '#DC2626',
              fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', animation: 'modalPopUp 0.2s ease'
            }}>
              {formError}
            </div>
          )}

          <div className={styles.formFooter}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Cancel</button>
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
  );
};

export default EventFormModal;