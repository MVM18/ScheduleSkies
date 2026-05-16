import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState, useEffect, useCallback } from 'react';
import {
  FaUserEdit,
  FaCalendarAlt,
  FaMoon,
  FaSun,
  FaSignOutAlt,
  FaTrashAlt,
  FaCamera,
  FaEnvelope,
  FaSync,
} from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';
import Sidebar from '../components/Sidebar';
import profileStyles from '../styles/profile.module.css';
import eventStyles from '../styles/event.module.css';

const ProfileEventCharts = dynamic(() => import('../components/ProfileEventCharts'), { ssr: false });

const THEME_STORAGE_KEY = 'schedule-skies-theme';

const defaultEventSummaries = () => ({
  total: 0,
  upcoming_count: 0,
  ongoing_count: 0,
  past_count: 0,
  by_category: {},
  total_price_php: 0,
  next_events: [],
});

const ProfilePage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Analytics');
  const [profileRefreshing, setProfileRefreshing] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [themeMode, setThemeMode] = useState('light');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const [eventSummaries, setEventSummaries] = useState(defaultEventSummaries);

  const [authUserId, setAuthUserId] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  const [loading, setLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  
  const [themeReady, setThemeReady] = useState(false);

  const showMessage = (type, value) => {
    setMessageType(type);
    setMessage(value);
    setTimeout(() => setMessage(''), 5000);
  };

  // Load theme preference
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeMode(savedTheme);
    } else {
      // Fallback to the global theme already applied by _app.js
      const bodyTheme = document.body.getAttribute('data-theme');
      setThemeMode(bodyTheme === 'dark' ? 'dark' : 'light');
    }
    setThemeReady(true);
  }, []);

  // Apply theme to body
  useEffect(() => {
    if (!themeReady || !themeMode) return;
    document.body.setAttribute('data-theme', themeMode);
  }, [themeMode, themeReady]);

  // Persist theme
  useEffect(() => {
    if (!themeReady || !themeMode) return;
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode, themeReady]);

  const loadProfile = useCallback(async (token, { quiet = false } = {}) => {
    if (!token) return;
    if (!quiet) setProfileRefreshing(true);
    setProfileError('');
    try {
      setLoading(true);
      const res = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Failed to load profile (${res.status})`);
      }

      setFullName(body.profile?.full_name || body.email?.split('@')[0] || 'User');
      setAvatarUrl(body.profile?.avatar_url || '');
      setEventSummaries(body.event_summaries || defaultEventSummaries());
    } catch (err) {
      console.error(err);
      setProfileError(err.message || 'Could not load profile data.');
    } finally {
      if (!quiet) setProfileRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    let cancelled = false;

    const init = async () => {
      const { data: authData, error: userError } = await supabase.auth.getUser();
      const authUser = authData?.user;

      if (userError || !authUser) {
        router.push('/');
        return;
      }

      if (cancelled) return;
      setAuthUserId(authUser.id);
      setEmail(authUser.email || '');

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        router.push('/');
        return;
      }
      if (cancelled) return;
      setSessionToken(token);
      await loadProfile(token, { quiet: true });
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [router, loadProfile]);

  const handleSaveProfile = async () => {
    if (!authUserId || !sessionToken) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to save (${res.status})`);
      }

      showMessage('success', 'Profile saved.');
      await loadProfile(sessionToken, { quiet: true });
    } catch (err) {
      console.error('Save error:', err);
      showMessage('error', err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sessionToken) return;
    if (!file.type.startsWith('image/')) {
      showMessage('error', 'Please choose an image file.');
      return;
    }
    if (file.size > 1.5 * 1024 * 1024) {
      showMessage('error', 'Image must be about 1.5MB or smaller.');
      return;
    }

    setAvatarBusy(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/profile/avatar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ imageBase64: dataUrl, contentType: file.type }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || j.hint || 'Upload failed');

      setAvatarUrl(j.avatar_url || '');
      showMessage('success', 'Profile photo updated.');
      await loadProfile(sessionToken, { quiet: true });
    } catch (err) {
      showMessage('error', err.message || 'Could not upload photo.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!sessionToken) return;
    setAvatarBusy(true);
    try {
      const res = await fetch('/api/profile/avatar', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      if (!res.ok) throw new Error('Could not remove photo');
      setAvatarUrl('');
      showMessage('success', 'Profile photo removed.');
      await loadProfile(sessionToken, { quiet: true });
    } catch (err) {
      showMessage('error', err.message || 'Remove failed.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const handleSendPasswordResetEmail = async () => {
    if (!email) {
      showMessage('error', 'No email on this account.');
      return;
    }
    setSecurityLoading(true);
    setMessage('');
    try {
      const origin = window.location.origin;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/reset-password`,
      });
      if (error) throw error;
      await supabase.auth.signOut();
      router.push('/login?reset=sent');
    } catch (err) {
      showMessage('error', err.message || 'Could not send reset email.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.prompt('Type DELETE to permanently remove your account.');
    if (confirmDelete !== 'DELETE') return;

    if (!sessionToken) {
      showMessage('error', 'Session expired. Please log in again.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/delete-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error || 'Failed to delete account.');
      }

      await supabase.auth.signOut();
      router.push('/signup');
    } catch (err) {
      showMessage('error', err.message);
    } finally {
      setSecurityLoading(false);
    }
  };

  const tabs = ['Analytics', 'Profile', 'Account'];

  return (
    <>
      <Head>
        <title>Account Profile - ScheduleSkies</title>
      </Head>
      <div className={eventStyles.appContainer}>
        <Sidebar />

        {loading ? (
          <div className="spinner-container" style={{height: "100vh"}}>
              <div className="loading-spinner"></div>
              <p>Loading Profile...</p>
          </div>
        ):(
          <main className={eventStyles.mainContent} style={{ padding: 0 }}>
          <div className={eventStyles.sun} />
          <div className={`${eventStyles.cloud} ${eventStyles.cloud1}`} />
          <div className={`${eventStyles.cloud} ${eventStyles.cloud2}`} />

          {(profileRefreshing || profileError) && (
            <div
              className={
                profileError ? profileStyles.inlineBannerError : profileStyles.inlineBanner
              }
            >
              {profileError ? (
                <span>{profileError}</span>
              ) : (
                <>
                  <FaSync className={profileStyles.spinIcon} /> Syncing profile…
                </>
              )}
              {!profileError && sessionToken && (
                <button
                  type="button"
                  className={profileStyles.bannerBtn}
                  onClick={() => sessionToken && loadProfile(sessionToken, { quiet: false })}
                >
                  Refresh
                </button>
              )}
            </div>
          )}

          <header className={profileStyles.profileHeader}>
            <div className={profileStyles.avatarBlock}>
              <div className={profileStyles.avatarHoverWrap}>
                <div className={profileStyles.profilePicture}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={profileStyles.profilePictureImg} />
                  ) : (
                    (fullName || 'U').charAt(0).toUpperCase()
                  )}
                  <label className={profileStyles.avatarCameraOverlay} title="Change profile photo">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className={profileStyles.hiddenFileInput}
                      onChange={handleAvatarChange}
                      disabled={avatarBusy || !sessionToken}
                    />
                    <span className={profileStyles.avatarCameraIcon}>
                      <FaCamera />
                    </span>
                  </label>
                </div>
              </div>
              {avatarUrl && (
                <button
                  type="button"
                  className={profileStyles.removePhotoBtn}
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                >
                  Remove photo
                </button>
              )}
            </div>
            <div className={profileStyles.profileInfo}>
              <div className={profileStyles.headerTitleRow}>
                <h1>{fullName || 'GUEST'}</h1>
                <div className={profileStyles.themeInline}>
                  <button
                    type="button"
                    className={`${profileStyles.themeIconBtn} ${themeMode === 'light' ? profileStyles.themeIconBtnOn : ''}`}
                    onClick={() => setThemeMode('light')}
                    title="Light mode"
                  >
                    <FaSun />
                  </button>
                  <button
                    type="button"
                    className={`${profileStyles.themeIconBtn} ${themeMode === 'dark' ? profileStyles.themeIconBtnOn : ''}`}
                    onClick={() => setThemeMode('dark')}
                    title="Dark mode"
                  >
                    <FaMoon />
                  </button>
                </div>
              </div>
              <p className={profileStyles.profileEmail}>{email}</p>
              <div className={profileStyles.quickStats}>
                <span>
                  {eventSummaries.total} plan event{eventSummaries.total === 1 ? '' : 's'}
                </span>

                <span>
                  {eventSummaries.upcoming_count} upcoming ,{' '}
                  {eventSummaries.ongoing_count} ongoing ,{' '}
                  {eventSummaries.past_count} completed
                </span>
              </div>
            </div>
          </header>

          <div className={profileStyles.profileBody}>
            <div className={profileStyles.tabNav}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`${profileStyles.tabBtn} ${activeTab === tab ? profileStyles.tabBtnActive : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>

            {message && (
              <div
                className={`${profileStyles.message} ${
                  messageType === 'error' ? profileStyles.messageError : profileStyles.messageSuccess
                }`}
              >
                {message}
              </div>
            )}

            <div className={profileStyles.tabContent}>
              {activeTab === 'Analytics' && (
                <div className={profileStyles.analyticsPageLayout}>
                  <div className={profileStyles.card}>
                    <h3>
                      <FaCalendarAlt /> Plan analytics
                    </h3>
                    <p className={profileStyles.mutedParagraph} style={{ marginTop: 0 }}>
                      Based on events you create on the{' '}
                      <Link href="/plan" className={`${profileStyles.textLink} ${profileStyles.textLinkInline}`}>
                        Plan
                      </Link>{' '}
                      page (not saved drafts).
                    </p>
                    <ProfileEventCharts eventSummaries={eventSummaries} themeMode={themeMode} />
                  </div>

                  {eventSummaries.total > 0 && (
                    <div className={profileStyles.card}>
                      <h3>Upcoming on your calendar</h3>
                      {(eventSummaries.next_events || []).length === 0 ? (
                        <p className={profileStyles.mutedParagraph}>No upcoming events — only completed items for now.</p>
                      ) : (
                        <ul className={profileStyles.nextEventList}>
                          {eventSummaries.next_events.map((ev) => (
                            <li key={ev.id} className={profileStyles.nextEventRow}>
                              <strong>{ev.title}</strong>
                              <span className={profileStyles.metaText}>
                                {ev.start_datetime
                                  ? new Date(ev.start_datetime).toLocaleString('en-PH')
                                  : ev.date || '—'}{' '}
                                · {ev.category}
                              </span>
                              {ev.location && (
                                <span className={profileStyles.metaText}>{ev.location}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Profile' && (
                <>
                  <div className={profileStyles.cardGrid}>
                    <div className={profileStyles.card}>
                      <h3>
                        <FaUserEdit /> Profile
                      </h3>
                      <div className={profileStyles.optionGroup}>
                        <label className={profileStyles.optionLabel} htmlFor="displayName">
                          Display name
                        </label>
                        <input
                          id="displayName"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={profileStyles.profileInput}
                          placeholder="Your name"
                        />
                      </div>
                    </div>
                  </div>

                  <div className={profileStyles.actionButtons}>
                    <button
                      type="button"
                      className={profileStyles.primaryBtn}
                      onClick={handleSaveProfile}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save profile'}
                    </button>
                    <button type="button" className={profileStyles.logoutBtn} onClick={handleLogout}>
                      <FaSignOutAlt /> Log out
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'Account' && (
                <div className={profileStyles.cardGrid}>
                  <div className={profileStyles.card}>
                    <h3>{themeMode === 'dark' ? <FaMoon /> : <FaSun />} Appearance</h3>
                    <p className={profileStyles.mutedParagraph}>
                      Quick toggle is also in the header. Preference is stored on this device.
                    </p>
                    <div className={profileStyles.segmented}>
                      <button
                        type="button"
                        className={`${profileStyles.segmentBtn} ${themeMode === 'light' ? profileStyles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('light')}
                      >
                        Light mode
                      </button>
                      <button
                        type="button"
                        className={`${profileStyles.segmentBtn} ${themeMode === 'dark' ? profileStyles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('dark')}
                      >
                        Dark mode
                      </button>
                    </div>
                  </div>

                  <div className={profileStyles.card}>
                    <h3>
                      <FaEnvelope /> Password (email link)
                    </h3>
                    <p className={profileStyles.mutedParagraph}>
                      We email a secure link to <strong>{email || 'your address'}</strong>. This session ends so you can
                      finish in the link; after you set a new password you are signed out again and can log in normally.
                    </p>
                    <div className={profileStyles.actionButtons}>
                      <button
                        type="button"
                        className={profileStyles.primaryBtn}
                        onClick={handleSendPasswordResetEmail}
                        disabled={securityLoading}
                      >
                        {securityLoading ? 'Sending…' : 'Send reset email'}
                      </button>
                    </div>
                  </div>

                  <div className={profileStyles.card}>
                    <h3>🔐 Danger zone</h3>
                    <div className={profileStyles.actionButtons}>
                      <button
                        type="button"
                        className={profileStyles.dangerBtn}
                        onClick={handleDeleteAccount}
                        disabled={securityLoading}
                      >
                        <FaTrashAlt /> Delete account
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
        )}

        
      </div>
    </>
  );
};

export default ProfilePage;
