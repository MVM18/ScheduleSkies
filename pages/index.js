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

export default function Home() {
  const [username, setUsername] = useState('User')

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
        
        <div className='home-header'>
        <WeatherOverview username={username} />
        </div>
        <div className="dashboard-content">
          <section className="row">
            <div className="col">
              <ForecastCards hours={[
                {time:'8 AM',icon:'sun',temp:28},
                {time:'12 PM',icon:'sun',temp:38},
                {time:'4 PM',icon:'cloud',temp:30},
                {time:'8 PM',icon:'sun',temp:28},
                
              ]} />
            </div>
            <div className="col">
              <TrafficInfo incidents={[
                {level:'heavy',location:'Natalio B. Bacalso Avenue'},
                {level:'moderate',location:'Tres de Abril Street'},
                {level:'heavy',location:'Natalio B. Bacalso Avenue'},
                {level:'moderate',location:'Tres de Abril Street'}
              ]} />
            </div>
            <div className="col">
              <Notifications notes={[
                {type:'rain',message:'It might rain on your trip this weekend',detail:'Don\'t Forget to Bring an Umbrella!'},
                {type:'heat',message:'High heat index expected tomorrow: 40°C',detail:'Stay Hydrated and Minimize Outdoor Activity'},
                {type:'rain',message:'It might rain on your trip this weekend',detail:'Don\'t Forget to Bring an Umbrella!'},
                {type:'heat',message:'High heat index expected tomorrow: 40°C',detail:'Stay Hydrated and Minimize Outdoor Activity'}
              ]} />
            </div>
          </section>

          <section className="row">
            <div className="col wide">
              <UpcomingPlans plans={[
                {date:'March 4, 2026', time: '7:00 PM', title:'DINNER DATE',location:"Wolfgang's Steakhouse Grill - Cebu City",distance:'📍3.5 km'},
                {date:'March 5, 2026', time: '12:00 PM', title:'LUNCH',location:'Anzani New Mediterranean Restaurant',distance:'📍5.1 km'},
                {date:'March 7, 2026', time: '10:00 AM', title:'BEACH TRIP',location:'Jpark Island Resort and Waterpark, Cebu',distance:'📍20.1 km'},
                {date:'March 4, 2026', time: '7:00 PM', title:'DINNER DATE',location:"Wolfgang's Steakhouse Grill - Cebu City",distance:'📍3.5 km'},
                {date:'March 5, 2026', time: '12:00 PM', title:'LUNCH',location:'Anzani New Mediterranean Restaurant',distance:'📍5.1 km'},
                {date:'March 7, 2026', time: '10:00 AM', title:'BEACH TRIP',location:'Jpark Island Resort and Waterpark, Cebu',distance:'📍20.1 km'}
              ]} />
            </div>
            <div className="col wide">
              <SuggestedPlaces places={[
                {image: '/images/fort.avif',name:'Fort San Pedro',description:'Remains of a triangular stone Spanish fortress, dating to 1738, today housing a garden & museum.',rating:'4.2',reviews:'7,739'},
                {image:'/images/magellan.webp',name:"Magellan's Cross",description:'Cross brought by Spanish explorers in 1521, marking the start of Christianity in the Philippines.',rating:'4.4',reviews:'11,666'},
                {image:'/images/ocean.jpg',name:'Cebu Ocean Park',description:'Aquarium',rating:'4.4',reviews:'4,458'},
                {image: '/images/fort.avif',name:'Fort San Pedro',description:'Remains of a triangular stone Spanish fortress, dating to 1738, today housing a garden & museum.',rating:'4.2',reviews:'7,739'},
                {image:'/images/magellan.webp',name:"Magellan's Cross",description:'Cross brought by Spanish explorers in 1521, marking the start of Christianity in the Philippines.',rating:'4.4',reviews:'11,666'},
                {image:'/images/ocean.jpg',name:'Cebu Ocean Park',description:'Aquarium',rating:'4.4',reviews:'4,458'}
              ]} />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
