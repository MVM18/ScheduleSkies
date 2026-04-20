import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import { FaUserCircle, FaSignOutAlt, FaCog } from 'react-icons/fa';
import Link from 'next/link';

export default function TopMenu() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (!user || router.pathname === '/profile') return null; // Only show on protected pages when logged in, and hide on profile since it has its own settings

  return (
    <div style={{ position: 'fixed', top: '25px', right: '40px', zIndex: 9999 }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'rgba(255, 255, 255, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: '50px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
          color: '#2C3E50',
          fontSize: '15px',
          fontWeight: '600',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.2s'
        }}
      >
        <FaUserCircle size={22} />
        {user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'Menu'}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '55px',
          right: '0',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRadius: '15px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.15)',
          minWidth: '180px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}>
          <Link href="/profile" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 15px',
            textDecoration: 'none',
            color: '#2C3E50',
            fontWeight: '600',
            borderRadius: '10px',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <FaCog /> Settings
          </Link>
          <button onClick={handleLogout} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px 15px',
            border: 'none',
            background: 'transparent',
            color: '#e74c3c',
            fontWeight: '600',
            cursor: 'pointer',
            textAlign: 'left',
            borderRadius: '10px',
            fontSize: '1rem',
            fontFamily: 'inherit',
            transition: 'background 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#fdf2f2'}
          onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <FaSignOutAlt /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}
