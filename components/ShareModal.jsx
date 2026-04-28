import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import styles from '../styles/share.module.css';

const ShareModal = ({ event, onClose }) => {
  const [role, setRole] = useState('view');
  const [expiryDays, setExpiryDays] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [existingShares, setExistingShares] = useState([]);
  const [isLoadingShares, setIsLoadingShares] = useState(true);
  const [error, setError] = useState('');

  const expiryOptions = [
    { label: 'Never', value: 0 },
    { label: '1 Day', value: 1 },
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
  ];

  const getAuthHeader = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session ? { Authorization: `Bearer ${session.access_token}` } : {};
  }, []);

  const fetchExistingShares = useCallback(async () => {
    setIsLoadingShares(true);
    try {
      const headers = await getAuthHeader();
      const res = await fetch(`/api/share/revoke?event_id=${event.id}`, { headers });
      const data = await res.json();
      if (data.shares) setExistingShares(data.shares);
    } catch (e) {
      console.error('Failed to fetch shares:', e);
    } finally {
      setIsLoadingShares(false);
    }
  }, [event.id, getAuthHeader]);

  useEffect(() => { fetchExistingShares(); }, [fetchExistingShares]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError('');
    try {
      const headers = await getAuthHeader();
      const res = await fetch('/api/share/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ event_id: event.id, role, expires_in_days: expiryDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setGeneratedLink({ url: data.share_url, role, id: data.share.id });
      await fetchExistingShares();
    } catch (e) {
      setError(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async (url, id) => {
    try { await navigator.clipboard.writeText(url); } catch { /* fallback omitted */ }
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleRevoke = async (shareId) => {
    if (!confirm('Remove this link? Anyone with it will lose access.')) return;
    const headers = await getAuthHeader();
    await fetch('/api/share/revoke', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ id: shareId }),
    });
    setExistingShares(prev => prev.filter(s => s.id !== shareId));
    if (generatedLink?.id === shareId) setGeneratedLink(null);
  };

  const formatExpiry = (expiresAt) => {
    if (!expiresAt) return 'Never expires';
    const diff = Math.ceil((new Date(expiresAt) - new Date()) / 86400000);
    if (diff <= 0) return 'Expired';
    return `Expires in ${diff} day${diff > 1 ? 's' : ''}`;
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className={styles.shareOverlay} onClick={onClose}>
      <div className={styles.shareModal} onClick={e => e.stopPropagation()}>

        <div className={styles.shareHeader}>
          <div className={styles.shareHeaderTop}>
            <div>
              <div className={styles.shareHeaderTitle}>Share Event</div>
              <h2>{event.title}</h2>
            </div>
            <button className={styles.shareCloseBtn} onClick={onClose}>✕</button>
          </div>
        </div>

        <div className={styles.shareBody}>
          {/* Role */}
          <div>
            <div className={styles.sectionLabel}>Access Level</div>
            <div className={styles.roleSelector}>
              <button className={`${styles.roleBtn} ${role === 'view' ? styles.roleBtnActive : ''}`} onClick={() => setRole('view')}>
                👁 View Only
              </button>
              <button className={`${styles.roleBtn} ${role === 'edit' ? styles.roleBtnActive : ''}`} onClick={() => setRole('edit')}>
                ✏️ Can Edit
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', fontWeight: 600 }}>
              {role === 'view' ? '📖 Viewer can see the event and navigate to venue' : '✏️ Collaborator can add, edit, and delete activities'}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <div className={styles.sectionLabel}>Link Expiry</div>
            <div className={styles.expirySelector}>
              {expiryOptions.map(opt => (
                <button key={opt.value} className={`${styles.expiryBtn} ${expiryDays === opt.value ? styles.expiryBtnActive : ''}`} onClick={() => setExpiryDays(opt.value)}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '10px', color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>
              ❌ {error}
            </div>
          )}

          <button className={styles.generateBtn} onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? '⏳ Generating...' : '🔗 Generate Share Link'}
          </button>

          {generatedLink && (
            <div className={styles.shareLinkSection}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>✅ Link ready — share it!</div>
              <div className={styles.shareLinkBox}>
                <span className={styles.shareLinkText}>{generatedLink.url}</span>
                <button className={`${styles.copyBtn} ${copiedId === generatedLink.id ? styles.copyBtnSuccess : ''}`} onClick={() => handleCopy(generatedLink.url, generatedLink.id)}>
                  {copiedId === generatedLink.id ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>
              <div className={styles.shareLinkMeta}>
                <span className={`${styles.roleBadge} ${generatedLink.role === 'edit' ? styles.roleBadgeEdit : styles.roleBadgeView}`}>
                  {generatedLink.role === 'edit' ? 'Can Edit' : 'View Only'}
                </span>
              </div>
            </div>
          )}

          {(existingShares.length > 0 || isLoadingShares) && (
            <div>
              <div className={styles.sectionLabel}>Active Links</div>
              {isLoadingShares ? (
                <div style={{ fontSize: '13px', color: '#94a3b8', padding: '12px 0' }}>Loading...</div>
              ) : (
                <div className={styles.sharesList}>
                  {existingShares.map(share => {
                    const url = share.share_url || `${baseUrl}/shared/${share.token}`;
                    const collabCount = share.share_collaborators?.length || 0;
                    return (
                      <div key={share.id} className={styles.shareItem}>
                        <div className={styles.shareItemIcon}>{share.role === 'edit' ? '✏️' : '👁'}</div>
                        <div className={styles.shareItemInfo}>
                          <div className={styles.shareItemLabel}>{share.label || 'Shared Link'}</div>
                          <div className={styles.shareItemMeta}>
                            <span className={`${styles.roleBadge} ${share.role === 'edit' ? styles.roleBadgeEdit : styles.roleBadgeView}`}>
                              {share.role === 'edit' ? 'Edit' : 'View'}
                            </span>
                            <span>{formatExpiry(share.expires_at)}</span>
                            {collabCount > 0 && <span>👥 {collabCount} joined</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className={`${styles.copyBtn} ${copiedId === share.id ? styles.copyBtnSuccess : ''}`} onClick={() => handleCopy(url, share.id)}>
                            {copiedId === share.id ? '✓' : '📋'}
                          </button>
                          <button className={styles.revokeBtn} onClick={() => handleRevoke(share.id)}>Revoke</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!isLoadingShares && existingShares.length === 0 && !generatedLink && (
            <div className={styles.emptyShareState}>🔗 No active links yet. Generate one above!</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
