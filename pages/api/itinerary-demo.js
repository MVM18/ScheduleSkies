/**
 * POST /api/itinerary-demo
 * Returns structured itinerary JSON + human summary for the landing demo.
 */

const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_BACKUP,
  process.env.GOOGLE_GEMINI_API_KEY,
  process.env.GOOGLE_GEMINI_API_KEY_BACKUP,
  process.env.NEXT_PUBLIC_GEMINI_API_KEY,
].filter(Boolean)
const GEMINI_MODEL = 'gemini-2.5-flash'

const ITINERARY_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          dayLabel: { type: 'STRING' },
          slots: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                time: { type: 'STRING' },
                title: { type: 'STRING' },
                location: { type: 'STRING' },
                category: { type: 'STRING' },
                notes: { type: 'STRING' },
                estimatedCostPHP: { type: 'STRING' },
              },
              required: ['time', 'title', 'location', 'category', 'notes', 'estimatedCostPHP'],
            },
          },
        },
        required: ['dayLabel', 'slots'],
      },
    },
  },
  required: ['summary', 'days'],
}

const JSON_SYSTEM = `You are SkyBot for ScheduleSkies (Cebu, Philippines). The user will describe a trip.

Respond with ONLY valid JSON (no markdown fences, no commentary) in this exact shape:
{
  "summary": "one short sentence",
  "days": [
    {
      "dayLabel": "Day 1",
      "slots": [
        {
          "time": "9:00 AM",
          "title": "short activity name",
          "location": "specific place or area in Cebu",
          "category": "Food | SightSeeing | Hotel | Leisure",
          "notes": "1 line tip or detail",
          "estimatedCostPHP": "e.g. ₱200-400 per person or —"
        }
      ]
    }
  ]
}

Rules:
- Use 2–4 slots per day unless the user asks for more.
- Categories must be exactly one of: Food, SightSeeing, Hotel, Leisure.
- Prefer realistic Cebu locations and PHP budgets.
- Times should progress through the day without overlap.
- If the user specifies number of days, match it; otherwise default to 3 days.`

function fallbackStructured(prompt) {
  const p = (prompt || '').toLowerCase()
  const days = p.includes('rain') || p.includes('indoor') ? 1 : 3
  const out = {
    summary: 'Demo itinerary (offline): classic Cebu highlights with food and sights.',
    days: [],
  }

  const templates = [
    [
      { time: '9:00 AM', title: 'Breakfast & coffee', location: 'Abaca Baking Company, Cebu IT Park', category: 'Food', notes: 'Fuel up before heading out.', estimatedCostPHP: '₱250–450' },
      { time: '11:00 AM', title: 'Historic downtown walk', location: 'Magellan’s Cross & Basilica del Sto. Niño', category: 'SightSeeing', notes: 'Go early; bring water and sun protection.', estimatedCostPHP: 'Free–₱100' },
      { time: '2:00 PM', title: 'Late lunch', location: 'House of Lechon, Cebu Business Park', category: 'Food', notes: 'Famous Cebu lechon.', estimatedCostPHP: '₱300–600' },
      { time: '5:00 PM', title: 'Sunset views', location: 'Tops Lookout, Busay', category: 'SightSeeing', notes: 'Allow extra time for weekend traffic.', estimatedCostPHP: '₱100+' },
    ],
    [
      { time: '8:30 AM', title: 'Island day trip kickoff', location: 'Mactan ferry / island hopping meetup', category: 'Leisure', notes: 'Book a reputable operator; check sea conditions.', estimatedCostPHP: '₱1,500–3,000' },
      { time: '1:00 PM', title: 'Seafood lunch', location: 'Lantaw Native Restaurant, SRP', category: 'Food', notes: 'Sea views; popular at lunch.', estimatedCostPHP: '₱350–700' },
      { time: '4:30 PM', title: 'Mall & A/C break', location: 'SM Seaside City Cebu', category: 'Leisure', notes: 'Good rainy-day backup.', estimatedCostPHP: '—' },
    ],
    [
      { time: '10:00 AM', title: 'Temple & photos', location: 'Temple of Leah, Busay', category: 'SightSeeing', notes: 'Wear comfy shoes; mid-morning light is great.', estimatedCostPHP: '₱100' },
      { time: '1:00 PM', title: 'Casual lunch', location: 'STK ta Bai! Paolito’s Seafood House', category: 'Food', notes: 'Local grilled seafood.', estimatedCostPHP: '₱200–500' },
      { time: '4:00 PM', title: 'Coffee & rest', location: 'Ayala Center Cebu', category: 'Food', notes: 'Avoid 5–7 PM rush if driving.', estimatedCostPHP: '₱150–350' },
    ],
  ]

  for (let i = 0; i < days; i += 1) {
    out.days.push({
      dayLabel: `Day ${i + 1}`,
      slots: templates[i % templates.length],
    })
  }

  return out
}

function tryParseStructuredJson(text) {
  if (!text || typeof text !== 'string') return null
  const trimmed = text
    .replace(/```json/gi, '```')
    .replace(/```/g, '')
    // normalize curly quotes sometimes returned by LLMs
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    // strip BOM if present
    .replace(/^\uFEFF/, '')
    .trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start < 0) return null
    if (end <= start) return null // likely truncated JSON

    const slice = trimmed.slice(start, end + 1)

    // Attempt a light repair pass: trailing commas + control chars
    const repaired = slice
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')

    try {
      return JSON.parse(repaired)
    } catch {
      return null
    }
  }
}

function validateShape(obj) {
  if (!obj || typeof obj !== 'object') return null
  if (!Array.isArray(obj.days)) return null
  const days = obj.days
    .filter((d) => d && typeof d === 'object')
    .map((d) => ({
      dayLabel: String(d.dayLabel || 'Day'),
      slots: Array.isArray(d.slots)
        ? d.slots
            .filter((s) => s && typeof s === 'object')
            .map((s) => ({
              time: s.time != null ? String(s.time) : '',
              title: s.title != null ? String(s.title) : 'Activity',
              location: s.location != null ? String(s.location) : 'Cebu City',
              category: s.category != null ? String(s.category) : 'Leisure',
              notes: s.notes != null ? String(s.notes) : '',
              estimatedCostPHP: s.estimatedCostPHP != null ? String(s.estimatedCostPHP) : '',
            }))
        : [],
    }))
    .filter((d) => d.slots.length > 0)

  if (days.length === 0) return null

  return {
    summary: obj.summary != null ? String(obj.summary) : '',
    days,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt, context, mode } = req.body || {}
  const userPrompt = typeof prompt === 'string' ? prompt.trim() : ''
  if (!userPrompt) {
    return res.status(400).json({ error: 'Prompt is required' })
  }

  const userMessage = `Create an itinerary from this trip request:\n${userPrompt}`

  const requestedMode = mode === 'online' || mode === 'offline' ? mode : 'auto'
  if (requestedMode === 'offline') {
    const structured = fallbackStructured(userPrompt)
    return res.status(200).json({
      structured,
      summary: structured.summary,
      source: 'fallback',
      mode: 'offline',
      requestedMode,
      warning: null,
    })
  }

  if (GEMINI_KEYS.length === 0) {
    const structured = fallbackStructured(userPrompt)
    return res.status(200).json({
      structured,
      summary: structured.summary,
      source: 'fallback',
      mode: 'offline',
      requestedMode,
      warning: requestedMode === 'online' ? 'Online mode requested but no Gemini API key was found in env.' : null,
    })
  }

  let contextBlock = ''
  if (context?.weather?.summary) {
    contextBlock += `\nWeather hint: ${context.weather.summary}`
  }
  if (context?.location) {
    contextBlock += `\nPreferred area: ${context.location}`
  }

  try {
    let lastGeminiError = null

    for (const geminiKey of GEMINI_KEYS) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`

      const geminiResponse = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: JSON_SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: userMessage + contextBlock }] }],
          generationConfig: {
            temperature: 0.55,
            topP: 0.9,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
            responseSchema: ITINERARY_RESPONSE_SCHEMA,
          },
        }),
      })

      if (!geminiResponse.ok) {
        lastGeminiError = await geminiResponse.text()
        continue
      }

      const geminiData = await geminiResponse.json()
      const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || ''
      const parsed = validateShape(tryParseStructuredJson(raw))

      if (!parsed) {
        const rawStr = String(raw || '')
        const isTruncated = rawStr.includes('{') && !rawStr.includes('}')
        const rawPreview = rawStr.slice(0, 260).replace(/\s+/g, ' ')
        lastGeminiError = isTruncated
          ? `Gemini response looks truncated (missing closing braces). Preview: ${rawPreview}`
          : rawPreview
            ? `Gemini response could not be parsed as itinerary JSON. Preview: ${rawPreview}`
            : 'Gemini response could not be parsed as itinerary JSON.'
        continue
      }

      return res.status(200).json({
        structured: parsed,
        summary: parsed.summary,
        source: 'gemini',
        mode: 'online',
        requestedMode,
        warning: null,
      })
    }

    const structured = fallbackStructured(userPrompt)
    return res.status(200).json({
      structured,
      summary: structured.summary,
      source: 'fallback',
      mode: 'offline',
      requestedMode,
      warning:
        requestedMode === 'online'
          ? `Online mode requested but Gemini failed${lastGeminiError ? `: ${String(lastGeminiError).slice(0, 220)}` : '.'} Using offline fallback.`
          : null,
    })
  } catch (e) {
    console.error('itinerary-demo error:', e)
    const structured = fallbackStructured(userPrompt)
    return res.status(200).json({
      structured,
      summary: structured.summary,
      source: 'fallback',
      mode: 'offline',
      requestedMode,
      warning:
        requestedMode === 'online' ? 'Online mode requested but the server request failed. Using offline fallback.' : null,
    })
  }
}
