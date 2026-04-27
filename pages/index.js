import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Sidebar from '@/components/Sidebar'
import WeatherOverview from '@/components/WeatherOverview'
import ForecastCards from '@/components/ForecastCards'
import TrafficInfo from '@/components/TrafficInfo'
import Notifications from '@/components/Notifications'
import UpcomingPlans from '@/components/UpcomingPlans'
import SuggestedPlaces from '@/components/SuggestedPlaces'
import { supabase } from '@/lib/supabaseClient'

import styles from '../styles/event.module.css';

export default function Home() {
  const [username, setUsername] = useState('User');
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    const fetchLoggedInUser = async () => {
      const { data: authData } = await supabase.auth.getUser()
      const user = authData?.user

      if (!user) {
        setUsername('User')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const displayName =
        profile?.full_name ||
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        'User'

      setUsername(displayName)
      setUserId(user.id)
    }

    fetchLoggedInUser()
  }, [])

  return (
    <>
      <Head>
        <title>Schedule Skies - Smart Travel Planning</title>
        <meta name="description" content="Plan your trips based on real-time weather and traffic predictions" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="dashboard">
        <Sidebar />
          <div className="sun"></div>
          <div className="cloud cloud1"></div>
          <div className="cloud cloud2"></div>

          <div className='home-header' style={{ background: 'rgba(255, 255, 255, 0.25)', backdropFilter: 'blur(15px)', padding: '10px 10px', borderRadius: '50px', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
            <WeatherOverview username={username} />
          </div>
          
          <div className="dashboard-content" style={{ paddingTop: '2rem' }}>
            <section className="row">
              <div className="col">
                <ForecastCards />
              </div>
              <div className="col">
                <TrafficInfo />
              </div>
              <div className="col">
                <Notifications userId={userId}/>
              </div>
            </section>

            <section className="row">
              <div className="col wide">
                <UpcomingPlans />
              </div>
              <div className="col wide">
                <SuggestedPlaces />
              </div>
            </section>
          </div>
        </main>
    </>
  )
}
