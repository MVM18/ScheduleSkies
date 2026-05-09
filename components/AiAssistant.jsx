import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';
import { buildWeatherContext, buildEventsContext, detectScheduleConflicts, suggestPackingList } from '@/lib/aiContext';
import { getLocationWithFallback } from '@/lib/getLocation';
import { writePendingItinerary } from '@/lib/itineraryImportShared';
import styles from '../styles/ai-assistant.module.css';

const WELCOME_ACTIONS = [
  { icon: '🧭', label: 'Generate a Cebu itinerary', message: 'Generate itinerary: Create a 3-day Cebu itinerary for two friends with beaches and local food.' },
  { icon: '🗓️', label: 'Optimize my itinerary', message: 'Optimize my itinerary and check for any scheduling issues' },
  { icon: '🌦️', label: 'Weather check for my trips', message: 'Check the weather forecast for my upcoming trips and suggest adjustments' },
  { icon: '🎒', label: 'What should I bring?', message: 'What should I pack and bring for my upcoming trips?' },
  { icon: '📍', label: 'Suggest places to visit', message: 'Suggest the best places to visit in Cebu' },
  { icon: '⚠️', label: 'Check for conflicts', message: 'Check my schedule for any conflicts or overlapping events' },
];

const PLAN_IMPORT_PATH = '/plan?import=1';
const ITINERARY_STORAGE_KEY = 'scheduleSkies_skybotItineraryDraft_v1';

function looksLikeItineraryPrompt(text) {
  const t = String(text || '').trim().toLowerCase();
  if (t.length < 18) return false;
  if (t.startsWith('generate itinerary:')) return true;
  // Heuristic: when the user is clearly asking for a generated trip plan.
  return (
    t.includes('itinerary') ||
    (t.includes('trip') && (t.includes('day') || t.includes('days') || /\b\d+\s*day\b/.test(t))) ||
    t.startsWith('plan a') ||
    t.startsWith('create a') ||
    t.startsWith('build a')
  );
}

export default function AiAssistant() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(['Generate itinerary', 'Plan my day', 'Weather check', 'Suggest places', 'What to bring?']);
  const [userEvents, setUserEvents] = useState([]);
  const [weatherContext, setWeatherContext] = useState(null);
  const [userLocation, setUserLocation] = useState('Cebu City');
  const [currentWeather, setCurrentWeather] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [itineraryDraft, setItineraryDraft] = useState(null); // { prompt, structured, source, summary }
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState(null); // { slot, dayLabel }

  const closeItinerary = () => setItineraryOpen(false);
  const closeSlot = () => setActiveSlot(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = localStorage.getItem(ITINERARY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.structured?.days?.length) {
        setItineraryDraft({
          prompt: typeof parsed.prompt === 'string' ? parsed.prompt : '',
          structured: parsed.structured,
          summary: parsed.structured?.summary || '',
          source: parsed.source || 'local',
        });
      }
    } catch {
      // ignore
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    if (!itineraryDraft?.structured?.days?.length) return;
    try {
      localStorage.setItem(
        ITINERARY_STORAGE_KEY,
        JSON.stringify({
          savedAt: new Date().toISOString(),
          prompt: itineraryDraft.prompt,
          source: itineraryDraft.source,
          structured: itineraryDraft.structured,
        })
      );
    } catch {
      // ignore
    }
  }, [mounted, itineraryDraft]);

  // Fetch user events and weather on mount
  useEffect(() => {
    const loadContext = async () => {
      try {
        // Fetch events
        const { data: events } = await supabase.from('events').select('*').order('date', { ascending: true });
        if (events) setUserEvents(events);

        // Fetch weather
        const { lat, lon } = await getLocationWithFallback();
        const weatherCtx = await buildWeatherContext(lat, lon);
        if (weatherCtx) {
          setWeatherContext(weatherCtx);
          setUserLocation(weatherCtx.city || 'Cebu City');
        }

        // Current weather
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.NEXT_PUBLIC_WEATHER_API_KEY}`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();
        if (weatherData?.main) {
          setCurrentWeather({
            temp: Math.round(weatherData.main.temp),
            description: weatherData.weather?.[0]?.description || 'Clear',
            city: weatherData.name || 'Cebu City',
          });
        }
      } catch (err) {
        console.error('Failed to load AI context:', err);
      }
    };
    loadContext();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && messages.length > 0) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!itineraryOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (activeSlot) {
          closeSlot();
          return;
        }
        closeItinerary();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [itineraryOpen, activeSlot]);

  const generateItinerary = async (rawPrompt) => {
    const prompt = String(rawPrompt || '').replace(/^generate itinerary:\s*/i, '').trim();
    if (!prompt) return;

    const userMsg = {
      role: 'user',
      content: prompt,
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/itinerary-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          mode: 'auto',
          context: {
            location: userLocation || 'Cebu City',
            weather: weatherContext?.summary
              ? { city: weatherContext.city || userLocation || 'Cebu City', summary: weatherContext.summary }
              : undefined,
          },
        }),
      });

      const data = await response.json();
      const structured = data?.structured;
      if (!structured?.days?.length) {
        throw new Error(data?.error || 'No itinerary returned.');
      }

      const draft = {
        prompt,
        structured,
        summary: structured.summary || '',
        source: data.source || 'unknown',
      };
      setItineraryDraft(draft);
      setItineraryOpen(true);

      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `${draft.summary ? `${draft.summary}\n\n` : ''}I generated an itinerary draft. Opening the cards preview now — you can send it to your Events/Plan page when ready.`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          source: draft.source === 'gemini' ? 'gemini' : 'local',
        },
      ]);
    } catch (err) {
      console.error('Itinerary generation failed:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'ai',
          content: `⚠️ I couldn't generate the itinerary right now. ${err?.message || ''}`.trim(),
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendItineraryToPlan = async () => {
    if (!itineraryDraft?.structured?.days?.length) return;
    writePendingItinerary({
      prompt: itineraryDraft.prompt,
      structured: itineraryDraft.structured,
      source: itineraryDraft.source,
    });
    const { data: { session } } = await supabase.auth.getSession();
    closeItinerary();
    if (session) {
      router.push(PLAN_IMPORT_PATH);
      return;
    }
    router.push(`/signup?returnTo=${encodeURIComponent(PLAN_IMPORT_PATH)}`);
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isLoading) return;

    if (looksLikeItineraryPrompt(text)) {
      await generateItinerary(text);
      return;
    }

    const userMsg = {
      role: 'user',
      content: text.trim(),
      time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build context
      const eventsCtx = buildEventsContext(userEvents);
      const conflicts = detectScheduleConflicts(userEvents);

      const response = await fetch('/api/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          context: {
            events: userEvents,
            weather: weatherContext,
            location: userLocation,
            conflicts,
            currentWeather,
          },
        }),
      });

      const data = await response.json();

      const aiMsg = {
        role: 'ai',
        content: data.reply || 'Sorry, I couldn\'t process that. Please try again.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        source: data.source,
      };

      setMessages(prev => [...prev, aiMsg]);

      if (data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('AI request failed:', err);
      setMessages(prev => [...prev, {
        role: 'ai',
        content: '⚠️ Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      }]);
    }

    setIsLoading(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(inputText);
  };

  const handleSuggestionClick = (text) => {
    if (text === 'Generate itinerary') {
      generateItinerary(inputText || 'Create a 3-day Cebu itinerary with food, sights, and a relaxed pace.');
      return;
    }
    sendMessage(text);
  };

  const openLastItinerary = () => {
    if (!itineraryDraft?.structured?.days?.length) return;
    setItineraryOpen(true);
  };

  const handleWelcomeAction = (action) => {
    sendMessage(action.message);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  // Format AI message content (basic markdown-like formatting)
  const formatContent = (content) => {
    if (!content) return '';
    
    return content
      .split('\n')
      .map((line, i) => {
        // Bold text
        let formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Italic text
        formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return `<div key="${i}" style="margin-bottom: ${line === '' ? '8px' : '2px'}">${formatted || '&nbsp;'}</div>`;
      })
      .join('');
  };

  // Floating button (when chat is closed)
  if (!isOpen) {
    return (
      <button
        className={styles.floatingBtn}
        onClick={() => setIsOpen(true)}
        title="Open AI Assistant"
        id="ai-assistant-toggle"
      >
        ✨
      </button>
    );
  }

  // Chat panel (when open)
  return (
    <div className={styles.chatPanel} id="ai-assistant-panel">
      {/* Header */}
      <div className={styles.chatHeader}>
        <div className={styles.chatBrand}>
          <div className={styles.chatBrandIcon}>✨</div>
          <div className={styles.chatBrandText}>
            <h3>SkyBot</h3>
            <div className={styles.chatBrandTextOnline}>
              <span className={styles.onlineDot}></span>
              <span>Travel Assistant</span>
            </div>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={() => setIsOpen(false)} title="Close">
          ✕
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messagesArea}>
        {messages.length === 0 ? (
          /* Welcome Screen */
          <div className={styles.welcomeCard}>
            <span className={styles.welcomeIcon}>🌤️</span>
            <h4>Hi! I&apos;m SkyBot</h4>
            <p>
              Your AI travel assistant for ScheduleSkies. I can help with itinerary planning,
              weather checks, place suggestions, and more!
            </p>
            <div className={styles.welcomeActions}>
              {WELCOME_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  className={styles.welcomeActionBtn}
                  onClick={() => handleWelcomeAction(action)}
                >
                  <span className={styles.welcomeActionIcon}>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Chat Messages */
          messages.map((msg, i) => (
            <div
              key={i}
              className={`${styles.messageBubble} ${msg.role === 'user' ? styles.userMessage : styles.aiMessage}`}
            >
              <div dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }} />
              <div className={styles.messageTime}>
                {msg.time}
                {msg.source && (
                  <span className={styles.sourceBadge} style={{ marginLeft: '6px' }}>
                    {msg.source === 'gemini' ? '✨ AI' : '📋 Local'}
                  </span>
                )}
              </div>
            </div>
          ))
        )}

        {/* Typing Indicator */}
        {isLoading && (
          <div className={styles.typingIndicator}>
            <div className={styles.typingDot}></div>
            <div className={styles.typingDot}></div>
            <div className={styles.typingDot}></div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Suggestions */}
      {messages.length > 0 && !isLoading && (
        <div className={styles.suggestionsBar}>
          {itineraryDraft?.structured?.days?.length ? (
            <button className={styles.suggestionChip} onClick={openLastItinerary}>
              View last itinerary
            </button>
          ) : null}
          {suggestions.map((s, i) => (
            <button
              key={i}
              className={styles.suggestionChip}
              onClick={() => handleSuggestionClick(s)}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <form className={styles.inputArea} onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          className={styles.chatInput}
          type="text"
          placeholder="Ask SkyBot anything..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          id="ai-chat-input"
        />
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!inputText.trim() || isLoading}
          title="Send message"
        >
          ➤
        </button>
      </form>

      {mounted && itineraryOpen && itineraryDraft?.structured
        ? createPortal(
            <div className={styles.itineraryBackdrop} role="presentation" onClick={closeItinerary}>
              <div
                className={styles.itineraryModal}
                role="dialog"
                aria-modal="true"
                aria-labelledby="skybot-itinerary-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.itineraryHeader}>
                  <div style={{ minWidth: 0 }}>
                    <div className={styles.itineraryKicker}>SkyBot itinerary draft</div>
                    <div id="skybot-itinerary-title" className={styles.itineraryTitle}>
                      {itineraryDraft.prompt}
                    </div>
                    {itineraryDraft.summary ? <div className={styles.itinerarySummary}>{itineraryDraft.summary}</div> : null}
                  </div>
                  <button type="button" className={styles.itineraryCloseBtn} onClick={closeItinerary} aria-label="Close">
                    ✕
                  </button>
                </div>

                <div className={styles.itineraryBody}>
                  {(itineraryDraft.structured.days || []).map((day, di) => (
                    <div key={`${day.dayLabel || 'day'}-${di}`} className={styles.itineraryDayCard}>
                      <div className={styles.itineraryDayTitle}>{day.dayLabel || `Day ${di + 1}`}</div>
                      <div className={styles.itinerarySlotList}>
                        {(day.slots || []).map((slot, si) => (
                          <button
                            key={`${slot.title}-${si}`}
                            type="button"
                            className={styles.itinerarySlotCard}
                            onClick={() => setActiveSlot({ slot, dayLabel: day.dayLabel || `Day ${di + 1}` })}
                            aria-label={`View details for ${slot.title || 'Activity'}`}
                          >
                            <div className={styles.itineraryThumb} aria-hidden="true">
                              <img
                                className={styles.itineraryThumbImg}
                                src={`/api/place-photo?q=${encodeURIComponent(
                                  `${slot.title || ''} ${slot.location || 'Cebu City'}`.trim()
                                )}&w=420`}
                                alt=""
                                loading="lazy"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <div className={styles.itinerarySlotContent}>
                              <div className={styles.itinerarySlotTopRow}>
                                <div className={styles.itinerarySlotTime}>{slot.time || '—'}</div>
                                <span className={styles.itineraryPill}>{slot.category || 'Leisure'}</span>
                              </div>
                              <div className={styles.itinerarySlotTitle}>{slot.title || 'Activity'}</div>
                              <div className={styles.itinerarySlotMeta}>{slot.location || 'Cebu City'}</div>
                              {slot.estimatedCostPHP ? <div className={styles.itinerarySlotCost}>{slot.estimatedCostPHP}</div> : null}
                              {slot.notes ? <div className={styles.itinerarySlotNotes}>{slot.notes}</div> : null}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.itineraryFooter}>
                  <button type="button" className={styles.itinerarySecondaryBtn} onClick={closeItinerary}>
                    Keep chatting
                  </button>
                  <button type="button" className={styles.itineraryPrimaryBtn} onClick={sendItineraryToPlan}>
                    Send to Events / Plan page
                  </button>
                </div>
              </div>

              {activeSlot ? (
                <div className={styles.slotDetailBackdrop} role="presentation" onClick={closeSlot}>
                  <div
                    className={styles.slotDetailModal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="skybot-slot-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className={styles.slotDetailHeader}>
                      <div style={{ minWidth: 0 }}>
                        <div className={styles.slotDetailDay}>{activeSlot.dayLabel}</div>
                        <div id="skybot-slot-title" className={styles.slotDetailTitle}>
                          {activeSlot.slot?.title || 'Activity'}
                        </div>
                        <div className={styles.slotDetailSubtitle}>
                          {activeSlot.slot?.time ? <span>{activeSlot.slot.time}</span> : null}
                          {activeSlot.slot?.location ? <span> · {activeSlot.slot.location}</span> : null}
                        </div>
                      </div>
                      <button type="button" className={styles.slotDetailCloseBtn} onClick={closeSlot} aria-label="Close">
                        ✕
                      </button>
                    </div>

                    <div className={styles.slotDetailBody}>
                      <div className={styles.slotDetailImageWrap} aria-hidden="true">
                        <img
                          className={styles.slotDetailImage}
                          src={`/api/place-photo?q=${encodeURIComponent(
                            `${activeSlot.slot?.title || ''} ${activeSlot.slot?.location || 'Cebu City'}`.trim()
                          )}&w=980`}
                          alt=""
                          loading="eager"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = '/images/logo.png'
                          }}
                        />
                      </div>

                      <div className={styles.slotDetailMetaPanel}>
                        <div className={styles.slotDetailPills}>
                          <span className={styles.slotDetailPill}>{activeSlot.slot?.category || 'Leisure'}</span>
                          {activeSlot.slot?.estimatedCostPHP ? (
                            <span className={styles.slotDetailPillSecondary}>{activeSlot.slot.estimatedCostPHP}</span>
                          ) : null}
                        </div>
                        {activeSlot.slot?.notes ? (
                          <p className={styles.slotDetailNotes}>{activeSlot.slot.notes}</p>
                        ) : (
                          <p className={styles.slotDetailNotesMuted}>No extra notes for this activity.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
