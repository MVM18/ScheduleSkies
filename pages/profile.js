import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Sidebar from '../components/Sidebar';
import styles from '../styles/profile.module.css';
import { FaCloud, FaDollarSign, FaMoon, FaSignOutAlt, FaSun, FaTrashAlt, FaUserEdit } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';

const fallbackUser = {
  full_name: 'Skies User',
  email: 'traveler@example.com',
  travel_preferences: {
    environment: 'Both',
    pace: 'Relaxed',
    budget: 1500,
    email_updates: true
  },
  saved_locations: [
    { id: '1', name: 'Fort San Pedro', type: 'Historical' },
    { id: '2', name: 'Cebu Ocean Park', type: 'Attraction' }
  ],
  saved_itineraries: [
    { id: '1', name: 'Cebu South Trip', date: 'March 4-7, 2026' },
    { id: '2', name: 'City Tour', date: 'April 10, 2026' }
  ],
  analytics: {
    trips_taken: 5,
    places_visited: 24,
    most_visited: 'Cebu City'
  }
};

const THEME_STORAGE_KEY = 'schedule-skies-theme';

const ProfilePage = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Preferences');
  const [userData, setUserData] = useState(fallbackUser);
  const [authUserId, setAuthUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [themeMode, setThemeMode] = useState('light');

  const [fullName, setFullName] = useState('');
  const [budget, setBudget] = useState(1500);
  const [environment, setEnvironment] = useState('Both');
  const [pace, setPace] = useState('Relaxed');
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [securityLoading, setSecurityLoading] = useState(false);

  const showMessage = (type, value) => {
    setMessageType(type);
    setMessage(value);
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setThemeMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: authData, error: userError } = await supabase.auth.getUser();
        const authUser = authData?.user;

        if (userError || !authUser) {
          router.push('/login');
          return;
        }

        setAuthUserId(authUser.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authUser.id)
          .maybeSingle();

        const resolvedName =
          profile?.full_name ||
          authUser.user_metadata?.full_name ||
          authUser.email?.split('@')[0] ||
          'User';

        const mergedUser = {
          ...fallbackUser,
          ...profile,
          full_name: resolvedName,
          email: authUser.email || fallbackUser.email
        };

        setUserData(mergedUser);
        setFullName(mergedUser.full_name);
        if (mergedUser.travel_preferences) {
          setBudget(mergedUser.travel_preferences.budget || 1500);
          setEnvironment(mergedUser.travel_preferences.environment || 'Both');
          setPace(mergedUser.travel_preferences.pace || 'Relaxed');
          setEmailUpdates(
            typeof mergedUser.travel_preferences.email_updates === 'boolean'
              ? mergedUser.travel_preferences.email_updates
              : true
          );
        }
      } catch (err) {
        console.log('Fetching user data failed, using fallback:', err.message);
        setUserData(fallbackUser);
        setFullName(fallbackUser.full_name);
        setBudget(fallbackUser.travel_preferences.budget);
        setEnvironment(fallbackUser.travel_preferences.environment);
        setPace(fallbackUser.travel_preferences.pace);
        setEmailUpdates(fallbackUser.travel_preferences.email_updates);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const profileStats = useMemo(() => {
    const itineraries = userData?.saved_itineraries?.length || 0;
    const locations = userData?.saved_locations?.length || 0;
    return { itineraries, locations };
  }, [userData]);

  const handleSaveProfile = async () => {
    if (!authUserId) return;

    setSaving(true);
    setMessage('');

    const payload = {
      id: authUserId,
      full_name: fullName.trim(),
      travel_preferences: {
        budget: Number(budget),
        environment,
        pace,
        email_updates: emailUpdates
      },
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert(payload);
    setSaving(false);

    if (error) {
      showMessage('error', `Unable to save profile: ${error.message}`);
      return;
    }

    setUserData((prev) => ({ ...prev, ...payload }));
    showMessage('success', 'Profile preferences saved.');
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showMessage('error', 'Password must be at least 6 characters.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSecurityLoading(false);

    if (error) {
      showMessage('error', `Password update failed: ${error.message}`);
      return;
    }

    setNewPassword('');
    showMessage('success', 'Password updated successfully.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmDelete = window.prompt('Type DELETE to permanently remove your account.');
    if (confirmDelete !== 'DELETE') return;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      showMessage('error', 'Session expired. Please log in again.');
      return;
    }

    setSecurityLoading(true);
    setMessage('');

    const response = await fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });

    const result = await response.json();
    setSecurityLoading(false);

    if (!response.ok) {
      showMessage('error', result?.error || 'Failed to delete account.');
      return;
    }

    await supabase.auth.signOut();
    router.push('/signup');
  };

  const OptionSelect = ({ label, options, selected, onSelect }) => (
    <div className={styles.option_group}>
      <span className={styles.option_label}>{label}</span>
      <div className={styles.options_container}>
        {options.map(opt => (
          <button 
            type="button"
            key={opt}
            className={`${styles.option_btn} ${selected === opt ? styles.option_active : ''}`}
            onClick={() => onSelect(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        Loading profile...
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Account Profile</title>
      </Head>
      <main className={`dashboard ${styles.profilePage} ${themeMode === 'dark' ? styles.dark : styles.light}`}>
        <Sidebar />
        
        <header className={styles.profile_header}>
          <div className={styles.profile_picture}>
            {(fullName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className={styles.profile_info}>
            <h1>{fullName || 'GUEST'}</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>{userData?.email}</p>
            <div className={styles.quickStats}>
              <span>{profileStats.itineraries} itineraries</span>
              <span>{profileStats.locations} saved places</span>
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          {message ? (
            <div className={`${styles.message} ${messageType === 'error' ? styles.error : styles.success}`}>
              {message}
            </div>
          ) : null}

          <div className={styles.tabs}>
            <button 
              className={`${styles.tab} ${activeTab === 'Preferences' ? styles.active : ''}`}
              onClick={() => setActiveTab('Preferences')}
            >
              Preferences
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Itineraries' ? styles.active : ''}`}
              onClick={() => setActiveTab('Itineraries')}
            >
              Itineraries & Locations
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Analytics' ? styles.active : ''}`}
              onClick={() => setActiveTab('Analytics')}
            >
              Analytics
            </button>
            <button 
              className={`${styles.tab} ${activeTab === 'Account' ? styles.active : ''}`}
              onClick={() => setActiveTab('Account')}
            >
              Account
            </button>
          </div>

          <div className={styles.profile_body}>
            {activeTab === 'Preferences' && (
              <>
                <section className="row">
                  <div className="col">
                    <div className={styles.card}>
                      <h3><FaUserEdit /> Profile</h3>
                      <div className={styles.option_group}>
                        <span className={styles.option_label}>Display Name</span>
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className={styles.profileInput}
                          placeholder="Your name"
                        />
                      </div>
                      <h3><FaCloud /> Travel Style</h3>
                      <OptionSelect 
                        label="Environment"
                        options={['Indoor', 'Outdoor', 'Both']}
                        selected={environment}
                        onSelect={setEnvironment}
                      />
                      <OptionSelect 
                        label="Pace"
                        options={['Relaxed', 'Moderate', 'Fast-paced']}
                        selected={pace}
                        onSelect={setPace}
                      />
                    </div>
                  </div>
                  <div className="col">
                    <div className={styles.card}>
                      <h3><FaDollarSign /> Budget</h3>
                      <div className={styles.budget_container}>
                        <div className={styles.budget_display}>
                          <span className={styles.budget_label}>Maximum Limit</span>
                          <span className={styles.budget_value}>${budget}</span>
                        </div>
                        <input 
                          type="range" 
                          min="100" 
                          max="10000" 
                          step="100" 
                          value={budget} 
                          onChange={(e) => setBudget(e.target.value)}
                          className={styles.range_slider} 
                        />
                        <div className={styles.range_labels}>
                          <span>$100</span>
                          <span>$10,000+</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
                <div className={styles.settings_button_container}>
                  <button className={styles.settings_button} type="button" onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </>
            )}
            
            {activeTab === 'Itineraries' && (
              <section className="row">
                <div className="col">
                  <div className={styles.card}>
                    <h3>Saved Itineraries</h3>
                    <div className={styles.list_container}>
                      {userData?.saved_itineraries?.map(itinerary => (
                        <div key={itinerary.id} className={styles.list_item}>
                          <h4>{itinerary.name}</h4>
                          <span className={styles.meta_text}>{itinerary.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div className={styles.card}>
                    <h3>Favorite Locations</h3>
                    <div className={styles.list_container}>
                      {userData?.saved_locations?.map(location => (
                        <div key={location.id} className={styles.list_item}>
                          <h4>{location.name}</h4>
                          <span className={styles.meta_text}>{location.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'Analytics' && (
              <section className="row">
                <div className="col">
                  <div className={styles.card}>
                    <h3>Travel Analytics</h3>
                    <div className={styles.analytics_grid}>
                      <div className={styles.stat_box}>
                        <span className={styles.stat_value}>{userData?.analytics?.trips_taken || 0}</span>
                        <span className={styles.stat_label}>Trips Taken</span>
                      </div>
                      <div className={styles.stat_box}>
                        <span className={styles.stat_value}>{userData?.analytics?.places_visited || 0}</span>
                        <span className={styles.stat_label}>Places Visited</span>
                      </div>
                      <div className={styles.stat_box}>
                        <span className={styles.stat_value_text}>{userData?.analytics?.most_visited || 'N/A'}</span>
                        <span className={styles.stat_label}>Most Visited City</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'Account' && (
              <section className="row">
                <div className="col">
                  <div className={styles.card}>
                    <h3>{themeMode === 'dark' ? <FaMoon /> : <FaSun />} Theme</h3>
                    <div className={styles.segmented}>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${themeMode === 'light' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('light')}
                      >
                        Light Mode
                      </button>
                      <button
                        type="button"
                        className={`${styles.segmentBtn} ${themeMode === 'dark' ? styles.segmentBtnActive : ''}`}
                        onClick={() => setThemeMode('dark')}
                      >
                        Dark Mode
                      </button>
                    </div>
                    <div className={styles.toggle_item}>
                      <span>Email updates</span>
                      <label className={styles.toggle_switch}>
                        <input
                          type="checkbox"
                          checked={emailUpdates}
                          onChange={(e) => setEmailUpdates(e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="col">
                  <div className={styles.card}>
                    <h3>Security</h3>
                    <div className={styles.option_group}>
                      <span className={styles.option_label}>New Password</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={styles.profileInput}
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div className={styles.actionGroup}>
                      <button type="button" className={styles.secondaryBtn} onClick={handleChangePassword} disabled={securityLoading}>
                        Update Password
                      </button>
                      <button type="button" className={styles.secondaryBtn} onClick={handleLogout}>
                        <FaSignOutAlt /> Log Out
                      </button>
                      <button type="button" className={styles.dangerBtn} onClick={handleDeleteAccount} disabled={securityLoading}>
                        <FaTrashAlt /> Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </>
  );
};

export default ProfilePage;
