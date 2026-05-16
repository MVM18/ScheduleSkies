import React from 'react';
import styles from '@/styles/event.module.css';

const EventsFilterBar = ({
  statusFilter, setStatusFilter, statusCounts,
  ownershipFilter, setOwnershipFilter, eventData, myEventsCount, sharedWithMeCount,
  activeFilter, setActiveFilter, categories,
  setIsCalendarOpen, handleOpenAddForm,
  isEditListMode, setIsEditListMode,
  handleAiAnalysis, isAiLoading,
  viewMode, setViewMode
}) => {
  return (
    <>
      {/* Status Filter Tabs */}
      <div className={styles.statusFilterBar}>
        {['Ongoing', 'Upcoming', 'Done'].map(status => (
          <button
            key={status}
            className={`${styles.statusBtn} ${statusFilter === status ? styles.statusBtnActive : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === 'Ongoing'} {status === 'Upcoming' && '🔜'} {status === 'Done' && '✅'} {status}
            <span className={styles.statusCount}>{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      {/* Ownership filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a365d', marginRight: '4px' }}>Events:</span>
        {[
          { key: 'all', label: 'All', count: eventData.length },
          { key: 'mine', label: 'My events', count: myEventsCount },
          { key: 'shared', label: 'Shared with me', count: sharedWithMeCount },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setOwnershipFilter(key)}
            style={{
              padding: '6px 12px', borderRadius: '999px',
              border: ownershipFilter === key ? '2px solid #4396D1' : '1px solid #cbd5e1',
              background: ownershipFilter === key ? '#E8F4FC' : '#fff',
              color: '#334155', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            {label}
            <span style={{ marginLeft: '6px', opacity: 0.75, fontWeight: 700 }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterDropdownMobile}>
          <select className={styles.mobileSelect} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div className={styles.actionGroup}>
          <button className={styles.actionBtn} onClick={() => setIsCalendarOpen(true)}>
            <span style={{ fontSize: '14px', color: '#76b5d9' }}>📅</span> Calendar
          </button>
          <button className={styles.actionBtn} onClick={handleOpenAddForm}>
            <span style={{ fontSize: '16px', color: '#76b5d9' }}>⊕</span> Add
          </button>
          <button className={`${styles.actionBtn} ${isEditListMode ? styles.activeEditBtn : ''}`} onClick={() => setIsEditListMode(!isEditListMode)}>
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

          <div className={styles.viewToggle}>
            <button className={`${styles.viewToggleBtn} ${viewMode === 'grid' ? styles.viewToggleActive : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </button>
            <button className={`${styles.viewToggleBtn} ${viewMode === 'list' ? styles.viewToggleActive : ''}`} onClick={() => setViewMode('list')} title="List view">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="4" width="18" height="3" rx="1"/><rect x="3" y="10.5" width="18" height="3" rx="1"/>
                <rect x="3" y="17" width="18" height="3" rx="1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EventsFilterBar;