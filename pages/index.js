import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '@/lib/supabaseClient'
import { writePendingItinerary, formatItineraryForCopy, PLAN_IMPORT_PATH } from '@/lib/itineraryImportShared'
import styles from '@/styles/landing.module.css'

const SAMPLE_PROMPTS = [
  'Create a 3-day Cebu itinerary for two friends with beaches, local food, and a budget of 12000 PHP.',
  'Plan a rainy-day Cebu itinerary from 9 AM to 8 PM with mostly indoor activities and cafe stops.',
  'Build a family-friendly weekend itinerary in Cebu with low walking distance and kid-friendly places.',
]

const SHOWCASE_CARDS = [
  {
    icon: '✨',
    title: 'What the AI can generate',
    description: 'Smart plans built from one prompt, ready to refine and save.',
  },
  {
    icon: '🗓️',
    title: 'Day-by-day itinerary structure',
    description: 'Clear timeline blocks so each day has realistic flow.',
  },
  {
    icon: '🌦️',
    title: 'Weather-aware schedule suggestions',
    description: 'Moves outdoor spots when rain risk is high and suggests backups.',
  },
  {
    icon: '💸',
    title: 'Budget-conscious recommendations',
    description: 'Includes practical stop ideas with expected PHP cost ranges.',
  },
  {
    icon: '🚗',
    title: 'Traffic-friendly timing adjustments',
    description: 'Avoids peak congestion windows to reduce travel delays.',
  },
]

const PLAN_WITH_IMPORT = `${PLAN_IMPORT_PATH}?import=1`

export default function Home() {
  const router = useRouter()
  const [checkingSession, setCheckingSession] = useState(true)
  const [showDemo, setShowDemo] = useState(false)
  const [demoMode, setDemoMode] = useState('auto') // auto | online | offline
  const [prompt, setPrompt] = useState(SAMPLE_PROMPTS[0])
  const [structured, setStructured] = useState(null)
  const [source, setSource] = useState('')
  const [modeStatus, setModeStatus] = useState('') // online | offline
  const [modeWarning, setModeWarning] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copyDone, setCopyDone] = useState(false)
  const [accountGateOpen, setAccountGateOpen] = useState(false)
  const [showcaseIndex, setShowcaseIndex] = useState(0)
  const [activeSlot, setActiveSlot] = useState(null)

  const closeSlotModal = () => setActiveSlot(null)

  useEffect(() => {
    if (!activeSlot) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeSlotModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeSlot])

  const isOnlineAttempt = demoMode !== 'offline'
  const lockPrompt = loading && isOnlineAttempt

  const runDemo = async () => {
    const trimmedPrompt = prompt.trim()
    if (!trimmedPrompt || loading) return

    setLoading(true)
    setError('')
    setModeWarning('')
    setStructured(null)
    setCopyDone(false)

    try {
      const response = await fetch('/api/itinerary-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmedPrompt,
          mode: demoMode,
          context: {
            location: 'Cebu City',
            weather: {
              city: 'Cebu City',
              summary:
                'Today: 31C, partly cloudy, 20% chance of rain. Tomorrow: 30C, scattered rain in the afternoon.',
            },
          },
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate demo itinerary')
      }

      if (!data.structured?.days?.length) {
        throw new Error('No itinerary days returned. Try again or adjust your prompt.')
      }

      setStructured(data.structured)
      setSource(data.source || 'unknown')
      setModeStatus(data.mode || '')
      if (data.warning) setModeWarning(data.warning)
    } catch (err) {
      setError(err.message || 'Unable to generate itinerary right now.')
    } finally {
      setLoading(false)
    }
  }

  const persistAndGoPlan = async () => {
    if (!structured?.days?.length) return
    writePendingItinerary({
      prompt: prompt.trim(),
      structured,
      source,
    })
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      router.push(PLAN_WITH_IMPORT)
      return
    }
    setAccountGateOpen(true)
  }

  const handleCopy = async () => {
    if (!structured) return
    const text = formatItineraryForCopy(structured, prompt.trim())
    try {
      await navigator.clipboard.writeText(text)
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  const returnToPlan = encodeURIComponent(PLAN_WITH_IMPORT)

  useEffect(() => {
    let alive = true
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!alive) return
        if (session) {
          router.replace('/dashboard')
          return
        }
      } finally {
        if (alive) setCheckingSession(false)
      }
    }
    check()
    return () => { alive = false }
  }, [router])

  if (checkingSession) return null

  return (
    <>
      <Head>
        <title>Schedule Skies | AI Itinerary Planner</title>
        <meta name="description" content="Generate smarter itineraries with weather-aware AI trip planning." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.page}>
        <header className={styles.nav}>
          <div className={styles.brand}>
            <img src="/images/logo.png" alt="Schedule Skies logo" className={styles.logo} />
            <span>Schedule Skies</span>
          </div>
          <nav className={styles.navActions}>
            <Link href={`/login?returnTo=${returnToPlan}`} className={styles.secondaryBtn}>
              Log In
            </Link>
            <Link href={`/signup?returnTo=${returnToPlan}`} className={styles.primaryBtn}>
              Get Started
            </Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroText}>
            <p className={styles.kicker}>AI-Powered Travel Planning</p>
            <h1>Turn a simple prompt into a complete itinerary plan.</h1>
            <p className={styles.subText}>
              Schedule Skies combines AI generation, weather insights, traffic-aware timing, and map-based planning
              so you can build realistic trips in minutes.
            </p>
            <div className={styles.heroCtas}>
              <button
                type="button"
                className={styles.primaryBtn}
                onClick={() => {
                  setShowDemo(true)
                  setTimeout(() => {
                    document.getElementById('ai-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 0)
                }}
              >
                Try Live Demo
              </button>
              <Link href={PLAN_WITH_IMPORT} className={styles.secondaryBtn}>
                Open Planner
              </Link>
            </div>
          </div>
          <div className={styles.heroCard}>
            <div className={styles.showcaseViewport}>
              <ul
                className={styles.showcaseTrack}
                style={{ transform: `translateX(-${showcaseIndex * 100}%)` }}
              >
                {SHOWCASE_CARDS.map((card, idx) => (
                  <li key={card.title} className={`${styles.showcaseItem} ${idx === 0 ? styles.showcaseIntro : ''}`}>
                    <span className={styles.showcaseIcon}>{card.icon}</span>
                    <div className={styles.showcaseTitle}>{card.title}</div>
                    <p className={styles.showcaseDesc}>{card.description}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.showcaseControls}>
              <button
                type="button"
                className={styles.showcaseNavBtn}
                onClick={() =>
                  setShowcaseIndex((prev) => (prev === 0 ? SHOWCASE_CARDS.length - 1 : prev - 1))
                }
              >
                ← Prev
              </button>
              <span className={styles.showcaseCount}>
                {showcaseIndex + 1}/{SHOWCASE_CARDS.length}
              </span>
              <button
                type="button"
                className={styles.showcaseNavBtn}
                onClick={() =>
                  setShowcaseIndex((prev) => (prev === SHOWCASE_CARDS.length - 1 ? 0 : prev + 1))
                }
              >
                Next →
              </button>
            </div>
            <div className={styles.showcaseDots}>
              {SHOWCASE_CARDS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`${styles.showcaseDot} ${idx === showcaseIndex ? styles.showcaseDotActive : ''}`}
                  onClick={() => setShowcaseIndex(idx)}
                  aria-label={`Show card ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className={styles.features}>
          <article>
            <h3>Prompt to Plan</h3>
            <p>Describe your trip goals in natural language and instantly receive a practical itinerary draft.</p>
          </article>
          <article>
            <h3>Smart Cebu Context</h3>
            <p>Recommendations are tuned for Cebu destinations, costs in PHP, and local peak traffic windows.</p>
          </article>
          <article>
            <h3>From Demo to Execution</h3>
            <p>Move from generated suggestions into your planner, map routes, and collaborative sharing flow.</p>
          </article>
        </section>

        {showDemo ? (
          <section id="ai-demo" className={`${styles.demoSection} ${styles.demoSlideIn}`}>
            <div className={styles.demoHeader}>
              <p className={styles.kicker}>Interactive Demo</p>
              <h2>Generate an itinerary from your prompt</h2>
            </div>
            <div className={styles.promptGroup}>
              <label htmlFor="ai-demo-prompt">Trip prompt</label>
              <div className={styles.modeRow}>
                <span className={styles.modeLabel}>Mode</span>
                <div className={styles.modeToggle} role="tablist" aria-label="Demo mode">
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${demoMode === 'auto' ? styles.modeBtnActive : ''}`}
                    onClick={() => setDemoMode('auto')}
                    disabled={loading}
                  >
                    Auto
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${demoMode === 'online' ? styles.modeBtnActive : ''}`}
                    onClick={() => setDemoMode('online')}
                    disabled={loading}
                  >
                    Online
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeBtn} ${demoMode === 'offline' ? styles.modeBtnActive : ''}`}
                    onClick={() => setDemoMode('offline')}
                    disabled={loading}
                  >
                    Offline
                  </button>
                </div>
              </div>
              {demoMode === 'online' && modeWarning ? (
                <div className={styles.warningBox}>
                  <strong>Online warning:</strong> {modeWarning}
                </div>
              ) : null}
              <textarea
                id="ai-demo-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                placeholder="Describe your ideal trip..."
                disabled={lockPrompt}
              />
              <div className={styles.promptActions}>
                {SAMPLE_PROMPTS.map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    className={styles.sampleBtn}
                    onClick={() => setPrompt(sample)}
                    disabled={lockPrompt}
                  >
                    Use sample
                  </button>
                ))}
              </div>
              <button type="button" className={styles.generateBtn} onClick={runDemo} disabled={loading}>
                {loading ? 'Generating itinerary...' : 'Generate Itinerary with AI'}
              </button>
            </div>

            <div className={styles.outputCard}>
              <h3>AI itinerary</h3>
              {loading ? (
                <div className={styles.loadingBlock} aria-live="polite">
                  <div className={styles.spinner} aria-hidden="true"></div>
                  <div className={styles.loadingText}>
                    {demoMode === 'online' ? 'Generating with Gemini…' : demoMode === 'auto' ? 'Generating…' : 'Generating offline…'}
                  </div>
                  <div className={styles.skeletonLine}></div>
                  <div className={styles.skeletonLine}></div>
                  <div className={styles.skeletonLineShort}></div>
                </div>
              ) : null}
              {error ? <p className={styles.error}>{error}</p> : null}
              {!loading && !error && !structured ? <p className={styles.placeholder}>Your generated itinerary will appear here.</p> : null}
              {structured ? (
                <>
                  <p className={styles.sourceTag}>
                    Source: {source === 'gemini' ? 'Gemini AI' : 'Local fallback assistant'}
                  </p>
                  {demoMode === 'online' && modeStatus === 'offline' ? (
                    <div className={styles.warningBox}>
                      <strong>Online requested, but offline used.</strong> {modeWarning || 'Gemini did not respond; fallback was used.'}
                    </div>
                  ) : null}
                  {structured.summary ? <p className={styles.summaryLine}>{structured.summary}</p> : null}
                  <div className={styles.itineraryCards}>
                    {(structured.days || []).map((day, di) => (
                      <div key={`${day.dayLabel || 'day'}-${di}`} className={styles.dayCard}>
                        <div className={styles.dayCardTitle}>{day.dayLabel || `Day ${di + 1}`}</div>
                        <div className={styles.slotList}>
                          {(day.slots || []).map((slot, si) => (
                            <button
                              key={`${slot.title}-${si}`}
                              type="button"
                              className={styles.slotCard}
                              onClick={() => setActiveSlot({ slot, dayLabel: day.dayLabel || `Day ${di + 1}` })}
                              aria-label={`View details for ${slot.title || 'Activity'}`}
                            >
                              <div className={styles.slotImageWrap} aria-hidden="true">
                                <img
                                  className={styles.slotImage}
                                  src={`/api/place-photo?q=${encodeURIComponent(
                                    `${slot.title || ''} ${slot.location || 'Cebu City'}`.trim()
                                  )}&w=360`}
                                  alt=""
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.src = '/images/logo.png'
                                  }}
                                />
                              </div>
                              <div className={styles.slotBody}>
                                <div className={styles.slotTopRow}>
                                  <div className={styles.slotTime}>{slot.time || '—'}</div>
                                  <span className={styles.slotCategory}>{slot.category || 'Leisure'}</span>
                                </div>
                                <div className={styles.slotTitle}>{slot.title || 'Activity'}</div>
                                <div className={styles.slotMeta}>{slot.location || 'Cebu'}</div>
                                {slot.estimatedCostPHP ? (
                                  <div className={styles.slotCost}>{slot.estimatedCostPHP}</div>
                                ) : null}
                                {slot.notes ? <p className={styles.slotNotes}>{slot.notes}</p> : null}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className={styles.demoActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={handleCopy}>
                      {copyDone ? 'Copied!' : 'Copy itinerary'}
                    </button>
                    <button type="button" className={styles.primaryBtn} onClick={persistAndGoPlan}>
                      Send to Plan page
                    </button>
                  </div>
                  <p className={styles.demoHint}>
                    Saving to your calendar requires an account. We store this draft in your browser only until you import it on
                    the Plan page.
                  </p>
                </>
              ) : null}
            </div>

            {activeSlot ? (
              <div className={styles.slotModalBackdrop} role="presentation" onClick={closeSlotModal}>
                <div
                  className={styles.slotModal}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="slot-modal-title"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={styles.slotModalHeader}>
                    <div style={{ minWidth: 0 }}>
                      <div className={styles.slotModalDay}>{activeSlot.dayLabel}</div>
                      <h2 id="slot-modal-title" className={styles.slotModalTitle}>
                        {activeSlot.slot?.title || 'Activity'}
                      </h2>
                      <div className={styles.slotModalSubtitle}>
                        {activeSlot.slot?.time ? <span>{activeSlot.slot.time}</span> : null}
                        {activeSlot.slot?.location ? <span> · {activeSlot.slot.location}</span> : null}
                      </div>
                    </div>
                    <button type="button" className={styles.slotModalClose} onClick={closeSlotModal} aria-label="Close">
                      ✕
                    </button>
                  </div>

                  <div className={styles.slotModalContent}>
                    <div className={styles.slotModalImageWrap} aria-hidden="true">
                      <img
                        className={styles.slotModalImage}
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

                    <div className={styles.slotModalMeta}>
                      <div className={styles.slotModalPills}>
                        <span className={styles.slotModalPill}>{activeSlot.slot?.category || 'Leisure'}</span>
                        {activeSlot.slot?.estimatedCostPHP ? (
                          <span className={styles.slotModalPillSecondary}>{activeSlot.slot.estimatedCostPHP}</span>
                        ) : null}
                      </div>
                      {activeSlot.slot?.notes ? (
                        <p className={styles.slotModalNotes}>{activeSlot.slot.notes}</p>
                      ) : (
                        <p className={styles.slotModalNotesMuted}>No extra notes for this activity.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </section>
        ) : (
          <section id="ai-demo" className={styles.demoSection}>
            <div className={styles.outputCard} style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
              <p className={styles.kicker}>Interactive Demo</p>
              <h2 style={{ marginTop: '0.25rem' }}>Generate an itinerary from your prompt</h2>
              <p className={styles.placeholder} style={{ marginTop: '0.5rem' }}>
                Click <strong>Try Live Demo</strong> above to open the generator.
              </p>
              <button
                type="button"
                className={styles.generateBtn}
                onClick={() => {
                  setShowDemo(true)
                  setTimeout(() => {
                    document.getElementById('ai-demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }, 0)
                }}
              >
                Open Demo
              </button>
            </div>
          </section>
        )}

        <footer className={styles.footer}>
          <p>Ready to build your full trip plan?</p>
          <div className={styles.heroCtas}>
            <Link href={`/signup?returnTo=${returnToPlan}`} className={styles.primaryBtn}>
              Create Free Account
            </Link>
            <Link href="/dashboard" className={styles.secondaryBtn}>
              Go to Dashboard
            </Link>
          </div>
        </footer>

        {accountGateOpen ? (
          <div className={styles.modalBackdrop} role="presentation" onClick={() => setAccountGateOpen(false)}>
            <div
              className={styles.modal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="account-gate-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="account-gate-title" className={styles.modalTitle}>
                Create an account to save this itinerary
              </h2>
              <p className={styles.modalText}>
                Your generated plan is saved in this browser session. Sign up or log in, then open <strong>My Events</strong> to
                review and save each activity to your calendar.
              </p>
              <div className={styles.modalActions}>
                <Link href={`/signup?returnTo=${returnToPlan}`} className={styles.primaryBtn}>
                  Create account
                </Link>
                <Link href={`/login?returnTo=${returnToPlan}`} className={styles.secondaryBtn}>
                  I already have an account
                </Link>
                <button type="button" className={styles.ghostBtn} onClick={() => setAccountGateOpen(false)}>
                  Keep editing demo
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </>
  )
}
