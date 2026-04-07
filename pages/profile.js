import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import styles from '../styles/profile.module.css';
import Sidebar from '../components/Sidebar';
import { FaCloud, FaDollarSign, FaCog } from 'react-icons/fa';
import { supabase } from '../lib/supabaseClient';

const fallbackUser = {
  username: 'VIN, SKIES',
  email: 'vin.skies@example.com',
  travel_preferences: {
    environment: 'Both',
    pace: 'Relaxed',
    budget: 1500
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

const ProfilePage = () => {
  const [activeTab, setActiveTab] = useState('Preferences');
  
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [budget, setBudget] = useState(1500);
  const [environment, setEnvironment] = useState('Both');
  const [pace, setPace] = useState('Relaxed');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          throw new Error('Not logged in');
        }

        const { data, error } = await supabase
          .from('User') 
          .select('*')
          .eq('user_id', session.user.id)
          .single();

        if (error || !data) {
          throw new Error('Could not fetch user data');
        }

        setUserData(data);
        if (data.travel_preferences) {
          setBudget(data.travel_preferences.budget || 1500);
          setEnvironment(data.travel_preferences.environment || 'Both');
          setPace(data.travel_preferences.pace || 'Relaxed');
        }
      } catch (err) {
        console.log('Fetching user data failed, using fallback:', err.message);
        setUserData(fallbackUser);
        setBudget(fallbackUser.travel_preferences.budget);
        setEnvironment(fallbackUser.travel_preferences.environment);
        setPace(fallbackUser.travel_preferences.pace);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const OptionSelect = ({ label, options, selected, onSelect }) => (
    <div className={styles.option_group}>
      <span className={styles.option_label}>{label}</span>
      <div className={styles.options_container}>
        {options.map(opt => (
          <button 
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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Loading profile...</div>;
  }

  return (
    <>
      <Head>
        <title>Account Profile</title>
      </Head>
      <main className="dashboard">
        <Sidebar />
        
        <header className={styles.profile_header}>
          <div className={styles.profile_picture}></div>
          <div className={styles.profile_info}>
            <h1>{userData?.username || 'GUEST'}</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.8 }}>{userData?.email}</p>
          </div>
        </header>

        <div className="dashboard-content">
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
          </div>

          <div className={styles.profile_body}>
            {activeTab === 'Preferences' && (
              <>
                <section className="row">
                  <div className="col">
                    <div className={styles.card}>
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
                  <button className={styles.settings_button}>
                    <FaCog /> Settings
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
          </div>
        </div>
      </main>
    </>
  );
};

export default ProfilePage;
