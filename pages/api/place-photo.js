const cache = new Map()
const CACHE_TTL = 1000 * 60 * 60 // 60 minutes
const FALLBACK_IMAGE = '/images/logo.png'

async function searchPhotoByText({ textQuery, apiKey }) {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.photos',
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 1,
      languageCode: 'en',
      regionCode: 'PH',
    }),
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = data?.error?.message || `Google Places searchText failed (${resp.status})`
    const err = new Error(msg)
    err._google = data
    throw err
  }

  const photoName = data?.places?.[0]?.photos?.[0]?.name
  return typeof photoName === 'string' && photoName.trim() ? photoName : null
}

async function resolvePhotoUri({ photoName, apiKey, maxWidthPx }) {
  // photoName is a resource path like: "places/PLACE_ID/photos/PHOTO_ID"
  // We must preserve slashes, but still encode individual segments.
  const safePath = String(photoName)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const url = `https://places.googleapis.com/v1/${safePath}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`
  const resp = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
    },
  })

  const data = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const msg = data?.error?.message || `Google Places photo media failed (${resp.status})`
    const err = new Error(msg)
    err._google = data
    throw err
  }

  const photoUri = data?.photoUri
  return typeof photoUri === 'string' && photoUri.trim() ? photoUri : null
}

export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.redirect(302, FALLBACK_IMAGE)
    return
  }

  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : ''
  if (!q) {
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.redirect(302, FALLBACK_IMAGE)
    return
  }

  const maxWidthPxRaw = typeof req.query?.w === 'string' ? parseInt(req.query.w, 10) : 320
  const maxWidthPx = Number.isFinite(maxWidthPxRaw) ? Math.min(Math.max(maxWidthPxRaw, 120), 800) : 320

  const cacheKey = `${q}::${maxWidthPx}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.redirect(302, cached.photoUri || FALLBACK_IMAGE)
    return
  }

  try {
    const photoName = await searchPhotoByText({ textQuery: q, apiKey })
    if (!photoName) {
      cache.set(cacheKey, { ts: Date.now(), photoUri: null })
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
      res.redirect(302, FALLBACK_IMAGE)
      return
    }

    const photoUri = await resolvePhotoUri({ photoName, apiKey, maxWidthPx })
    cache.set(cacheKey, { ts: Date.now(), photoUri: photoUri || null })

    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.redirect(302, photoUri || FALLBACK_IMAGE)
    return
  } catch (err) {
    console.error('place-photo error:', err?.message || err)
    cache.set(cacheKey, { ts: Date.now(), photoUri: null })
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600')
    res.redirect(302, FALLBACK_IMAGE)
    return
  }
}

