import React from 'react';
import styles from '@/styles/event.module.css';

const EventList = ({
  events, viewMode, isEditListMode,
  handleOpenItinerary, handleOpenEditForm, handleDeleteEvent,
  ownershipFilter, sharedWithMeCount, myEventsCount, statusFilter,
  getEventStatus, formatDateRange
}) => {
  if (events.length === 0) {
    return (
      <div className={styles.emptyState}>
        {ownershipFilter === 'shared' && sharedWithMeCount === 0
          ? 'Nothing has been shared with you yet. When someone adds you as a collaborator, their event will appear here.'
          : ownershipFilter === 'mine' && myEventsCount === 0
            ? 'You have no events you own yet. Click "Add" to create one.'
            : statusFilter === 'Done'
              ? 'No completed events yet.'
              : statusFilter === 'Upcoming'
                ? 'No upcoming events. Click "Add" to create one!'
                : 'No events match these filters.'}
      </div>
    );
  }

  return (
    <section className={viewMode === 'grid' ? styles.eventList : styles.eventListView}>
      {events.map(event => {
        const status = getEventStatus(event);
        const range = event.start_datetime ? formatDateRange(event.start_datetime, event.end_datetime) : null;

        if (viewMode === 'grid') {
          return (
            <div key={event.id} className={styles.eventCard} style={{
              position: 'relative', backgroundImage: `url(${event.image_link})`,
              backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat',
            }} onClick={() => handleOpenItinerary(event)}>
              <span>
                <div className={styles.titleContainer}><p>{event.title}</p></div>
              </span>
              <span className={styles.cardStatusBadge} style={{
                background: status === 'done' ? '#D1F2E0' : '#D5EAF9',
                color: status === 'done' ? '#15A862' : '#4396D1',
                border: '0.5px solid black'
              }}>
                {status === 'done' ? 'Done' : 'Upcoming'}
              </span>
              <div style={{ display: 'flex', gap: '6px', position: 'absolute', bottom: '12px', left: '12px', right: '12px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                {event.isShared && (
                  <span style={{
                    background: 'rgba(100, 116, 139, 0.95)', color: '#fff', padding: '4px 10px',
                    borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                    border: '0.5px solid rgba(255, 255, 255, 0.3)', backdropFilter: 'blur(8px)',
                  }}>Shared with me</span>
                )}
              </div>
              {isEditListMode && (
                <div className={styles.cardActions}>
                  <button onClick={(e) => { e.stopPropagation(); handleOpenEditForm(event) }} className={styles.iconBtnEdit}>✎</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id) }} className={styles.iconBtnDelete}>🗑</button>
                </div>
              )}
            </div>
          );
        } else {
          return (
            <div key={event.id} className={styles.eventListItem} onClick={() => handleOpenItinerary(event)}>
              <div className={styles.listThumb}>
                {event.image_link ? <img src={event.image_link} alt={event.title} /> : <div className={styles.listThumbPlaceholder}>{event.category[0]}</div>}
              </div>
              <div className={styles.listInfo}>
                <div className={styles.listTitle}>{event.title}</div>
                <div className={styles.listMeta}>
                  {event.venue && <span>🏛️ {event.venue}</span>}
                  <span>📍 {event.location}</span>
                  {range && <span>📅 {range.dateStr} · {range.startTime}{range.endTime ? ` – ${range.endTime}` : ''}</span>}
                </div>
                <div className={styles.listTags}>
                  <span className={styles.listCategoryTag} style={{ background: event.typeColor + '22', color: event.typeColor, border: `1px solid ${event.typeColor}44` }}>
                    {event.category}
                  </span>
                  {event.price && <span className={styles.listPriceTag}>💰 {event.price}</span>}
                </div>
              </div>
              <div className={styles.listRight}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: isEditListMode ? '8px' : '0' }}>
                  {event.isShared && (
                     <span style={{
                        background: 'rgba(100, 116, 139, 0.95)', color: '#fff', padding: '4px 10px',
                        borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                        border: '0.5px solid rgba(255, 255, 255, 0.3)', whiteSpace: 'nowrap',
                      }}>Shared with me</span>
                  )}
                  <span className={styles.cardStatusBadge} style={{
                    background: status === 'done' ? '#D1F2E0' : '#D5EAF9',
                    color: status === 'done' ? '#15A862' : '#4396D1',
                    border: '0.5px solid black', position: 'static',
                  }}>
                    {status === 'done' ? 'Done' : 'Upcoming'}
                  </span>
                </div>
                {isEditListMode && (
                  <div className={styles.listActions}>
                    <button onClick={(e) => { e.stopPropagation(); handleOpenEditForm(event) }} className={styles.iconBtnEdit}>✎</button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(event.id) }} className={styles.iconBtnDelete}>🗑</button>
                  </div>
                )}
              </div>
            </div>
          );
        }
      })}
    </section>
  );
};

export default EventList;