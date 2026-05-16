import React from 'react';
import styles from '@/styles/event.module.css';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, addDays, isToday } from 'date-fns';

const CalendarModal = ({
  isOpen, onClose, calendarDate, calendarDirection, handleToday, handlePrevMonth, handleNextMonth, handleMonthDragEnd,
  calendarViewMode, setCalendarViewMode, isLoadingAllActivities, eventData, allCalendarActivities,
  calendarConflictEventIds, handleDropOnDate, dragOverDate, setDragOverDate, handleDragStart, handleDragEnd, formatTime, getEventCalendarDate
}) => {
  if (!isOpen) return null;

  const calVariants = {
    enter: (direction) => ({ x: direction > 0 ? 100 : -100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction) => ({ x: direction < 0 ? 100 : -100, opacity: 0 }),
  };

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

      let dayItems = [];
      let hasEvent = false;
      let hasConflict = false;

      if (calendarViewMode === 'events') {
        dayItems = eventData.filter(e => getEventCalendarDate(e) === dateStr);
        hasEvent = dayItems.length > 0;
        hasConflict = dayItems.some(ev => calendarConflictEventIds.has(ev.id));
      } else {
        dayItems = allCalendarActivities.filter(a => (a.start_time ? a.start_time.split('T')[0] : '') === dateStr);
        hasEvent = dayItems.length > 0;
      }

      const isCurrentMonth = isSameMonth(cloneDay, monthStart);
      const isCurrentDay = isToday(cloneDay); 

      cellDays.push(
        <div
          key={cloneDay.toString()}
          className={styles.calCell}
          onDrop={(e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
            if (calendarViewMode === 'events') handleDropOnDate(dateStr); 
          }}
          onDragOver={(e) => { 
            e.preventDefault(); 
            if (calendarViewMode === 'events') setDragOverDate(dateStr); 
          }}
          onDragLeave={() => {
            if (calendarViewMode === 'events') setDragOverDate(null);
          }}
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
              backgroundColor: '#10B981', color: 'white', borderRadius: '50%', width: '24px', height: '24px',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', margin: '0 auto 6px auto'
            } : hasEvent ? { fontWeight: 'bold', color: '#76b5d9' } : {}}
          >
            {format(cloneDay, 'd')}
          </span>
          <div className={styles.calEventsContainer}>
            {dayItems.map(item => {
              if (calendarViewMode === 'events') {
                const ev = item;
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
                      backgroundColor: isConflict ? '#EF4444' : ev.typeColor, color: isConflict ? '#fff' : '#111',
                      border: isConflict ? '1px solid #DC2626' : undefined, cursor: 'grab'
                    }}
                    title={`Drag to move event to another day`}
                  >
                    {eventTime} · {ev.title}
                  </div>
                );
              } else {
                const act = item;
                const actTime = act.start_time ? formatTime(act.start_time) : 'All Day';
                const parentEvent = eventData.find(e => e.id === act.event_id);
                const bgColor = parentEvent ? parentEvent.typeColor : '#8B5CF6';

                return (
                  <div
                    key={`act-${act.id}`}
                    className={styles.calEventPill}
                    style={{ backgroundColor: bgColor, color: '#111', cursor: 'default', opacity: 0.95 }}
                    title={`${actTime} - ${act.activity_name}\nEvent: ${parentEvent?.title || 'Unknown'}`}
                  >
                    {actTime} · {act.activity_name}
                  </div>
                );
              }
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    return cellDays;
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.calendarModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.calHeader}>
          <div className={styles.calHeaderLeft}>
            <button className={styles.calTodayBtn} onClick={handleToday}>Today</button>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button onClick={handlePrevMonth} onDragEnter={(e) => { e.preventDefault(); handlePrevMonth(); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                <ChevronLeft size={16} /> Prev
              </button>
              <button onClick={handleNextMonth} onDragEnter={(e) => { e.preventDefault(); handleNextMonth(); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #444', background: '#2a2a2a', color: '#fff', cursor: 'pointer', fontSize: '13px' }}>
                Next <ChevronRight size={16} />
              </button>
            </div>
            <h2>{format(calendarDate, "MMMM yyyy")}</h2>
          </div>
          <div className={styles.calHeaderRight}>
            <div style={{ display: 'flex', background: '#222', borderRadius: '8px', padding: '4px', border: '1px solid #333', marginRight: '16px' }}>
              <button onClick={() => setCalendarViewMode('events')} style={{ background: calendarViewMode === 'events' ? '#444' : 'transparent', color: calendarViewMode === 'events' ? '#fff' : '#888', border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>Events</button>
              <button onClick={() => setCalendarViewMode('activities')} style={{ background: calendarViewMode === 'activities' ? '#444' : 'transparent', color: calendarViewMode === 'activities' ? '#fff' : '#888', border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}>{isLoadingAllActivities ? 'Loading...' : 'Itinerary'}</button>
            </div>
            <button className={styles.calCloseBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.calWeekdays}>
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => <div key={day}>{day}</div>)}
        </div>

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
  );
};

export default CalendarModal;