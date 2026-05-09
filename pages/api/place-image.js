export default async function handler(req, res) {
  const { query } = req.query
  if (!query) return res.status(400).json({ error: 'No query' })

  const KEY = process.env.GOOGLE_PLACES_API_KEY

  try {
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${KEY}`
    )
    const searchData = await searchRes.json()
    const photoRef = searchData.results?.[0]?.photos?.[0]?.photo_reference

    if (!photoRef) return res.status(404).json({ url: null })

    // Return the photo URL — browser fetches this directly (it redirects, no CORS issue)
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${KEY}`
    return res.status(200).json({ url: photoUrl })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}