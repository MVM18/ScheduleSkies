import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient';
import styles from '../styles/eventGalleryHeader.module.css'


const MAX_IMAGES = 10

export default function EventGalleryHeader({ event, userId, onCoverChange, onClose }) {
  const [images, setImages] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [showControls, setShowControls] = useState(false)
  const fileInputRef = useRef(null)
  const coverInputRef = useRef(null)

  // Build full image list: cover first, then event_images
  useEffect(() => {
    if (!event) return
    fetchImages()
  }, [event])

  async function fetchImages() {
    const { data } = await supabase
      .from('event_images')
      .select('id, url, path')
      .eq('event_id', event.id)
      .order('created_at', { ascending: true })

    const extras = data ?? []

    // Cover image always first if it exists
    const coverEntry = event.image_link
      ? [{ id: 'cover', url: event.image_link, path: null, isCover: true }]
      : []

    // Deduplicate: don't show cover url again in extras
    const filtered = extras.filter(img => img.url !== event.image_link)

    setImages([...coverEntry, ...filtered])
    setCurrentIndex(0)
  }

  const totalImages = images.length
  const current = images[currentIndex]
  const canUpload = totalImages < MAX_IMAGES

  function prev() {
    setCurrentIndex(i => (i - 1 + totalImages) % totalImages)
  }

  function next() {
    setCurrentIndex(i => (i + 1) % totalImages)
  }

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [totalImages])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !canUpload) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/${event.id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(path, file)

    if (uploadError) {
      console.error('Upload failed:', uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(path)

    const url = urlData.publicUrl

    await supabase.from('event_images').insert({
      event_id: event.id,
      user_id: userId,
      url,
      path,
    })

    await fetchImages()
    // Jump to newly added image (last)
    setCurrentIndex(images.length) // will be the new last after fetch
    setUploading(false)
  }

  async function handleSetCover() {
    if (!current || current.isCover) return

    // 1. Upload the current cover (event.image_link) to storage so it's preserved
    let oldCoverNewUrl = null
    if (event.image_link) {
      try {
        const coverRes = await fetch(event.image_link)
        const blob = await coverRes.blob()
        const ext = event.image_link.split('.').pop().split('?')[0] || 'jpg'
        const path = `${userId}/${event.id}/${Date.now()}_swapped.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from('event-images')
          .upload(path, blob, { contentType: blob.type })

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('event-images')
            .getPublicUrl(path)
          oldCoverNewUrl = urlData.publicUrl

          // Save old cover as an event_image row
          await supabase.from('event_images').insert({
            event_id: event.id,
            user_id: userId,
            url: oldCoverNewUrl,
            path,
          })
        }
      } catch (err) {
        console.error('Failed to preserve old cover:', err)
      }
    }

    // 2. Set the selected image as the new cover
    await supabase
      .from('events')
      .update({ image_link: current.url })
      .eq('id', event.id)

    // 3. Remove the selected image from event_images (it's now the cover)
    await supabase.from('event_images').delete().eq('id', current.id)

    onCoverChange?.(current.url)
    await fetchImages()
    setCurrentIndex(0)
  }

  async function handleChangeCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/${event.id}/cover_${Date.now()}.${ext}`

    // 1. Upload new cover to storage
    const { error: uploadError } = await supabase.storage
      .from('event-images')
      .upload(path, file)

    if (uploadError) {
      console.error('Cover upload failed:', uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('event-images')
      .getPublicUrl(path)

    const newCoverUrl = urlData.publicUrl

    // 2. Move old cover to event_images if it exists
    if (event.image_link) {
      try {
        const coverRes = await fetch(event.image_link)
        const blob = await coverRes.blob()
        const oldExt = event.image_link.split('.').pop().split('?')[0] || 'jpg'
        const oldPath = `${userId}/${event.id}/${Date.now()}_prev_cover.${oldExt}`

        const { error: oldUploadErr } = await supabase.storage
          .from('event-images')
          .upload(oldPath, blob, { contentType: blob.type })

        if (!oldUploadErr) {
          const { data: oldUrlData } = supabase.storage
            .from('event-images')
            .getPublicUrl(oldPath)

          await supabase.from('event_images').insert({
            event_id: event.id,
            user_id: userId,
            url: oldUrlData.publicUrl,
            path: oldPath,
          })
        }
      } catch (err) {
        console.error('Failed to preserve old cover:', err)
      }
    }

    // 3. Update event.image_link to new cover
    await supabase
      .from('events')
      .update({ image_link: newCoverUrl })
      .eq('id', event.id)

    onCoverChange?.(newCoverUrl)
    await fetchImages()
    setCurrentIndex(0)
    setUploading(false)
  }

  async function handleDelete() {
    if (!current) return

    if (current.isCover) {
      // Clear cover from events table
      await supabase.from('events').update({ image_link: null }).eq('id', event.id)
      onCoverChange?.(null)
    } else {
      // Delete from storage + table
      if (current.path) {
        await supabase.storage.from('event-images').remove([current.path])
      }
      await supabase.from('event_images').delete().eq('id', current.id)
    }

    setCurrentIndex(0)
    await fetchImages()
  }

  return (
    <div
      className={styles.galleryHeader}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Main image */}
      <div className={styles.imageStage}>
        {current ? (
          <img
            key={current.url}
            src={current.url}
            alt={`Event photo ${currentIndex + 1}`}
            className={styles.mainImage}
          />
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🖼️</span>
            <span>No photos yet</span>
          </div>
        )}

        {/* Dark gradient overlay at bottom */}
        <div className={styles.gradientOverlay} />

        {/* Cover badge */}
        {current?.isCover && (
          <div className={styles.coverBadge}>Cover</div>
        )}

        {/* Top-right actions */}
        <div className={`${styles.topActions} ${showControls ? styles.visible : ''}`}>
          
          {/* Change cover — only shows when on cover image */}
          {current?.isCover && (
            <button
              className={`${styles.actionBtn} ${styles.changeCoverBtn}`}
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading}
              title="Change cover photo"
            >
              {uploading ? (
                <span className={styles.spinner} />
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
              <span>Change cover</span>
            </button>
          )}

          {/* Upload new photo */}
          {canUpload && (
            <button
              className={styles.actionBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title={`Add photo (${totalImages}/${MAX_IMAGES})`}
            >
              {uploading ? (
                <span className={styles.spinner} />
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              )}
              <span>{totalImages}/{MAX_IMAGES}</span>
            </button>
          )}

          {/* Set as cover — only shows on non-cover images */}
          {current && !current.isCover && (
            <button
              className={styles.actionBtn}
              onClick={handleSetCover}
              title="Set as cover"
              disabled={uploading}
            >
              {uploading ? <span className={styles.spinner} /> : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              )}
              <span>Set cover</span>
            </button>
          )}

          {/* Delete */}
          {current && (
            <button
              className={`${styles.actionBtn} ${styles.deleteBtn}`}
              onClick={handleDelete}
              title="Remove photo"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6"/>
              </svg>
            </button>
          )}
          
          <button 
          className={styles.actionBtn} 
          onClick={onClose}
          title="Close Itinerary"
          >✕</button>
        </div>

        {/* Prev / Next */}
        {totalImages > 1 && (
          <>
            <button
              className={`${styles.navBtn} ${styles.navPrev} ${showControls ? styles.visible : ''}`}
              onClick={prev}
              aria-label="Previous photo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button
              className={`${styles.navBtn} ${styles.navNext} ${showControls ? styles.visible : ''}`}
              onClick={next}
              aria-label="Next photo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </>
        )}

        {/* Dot indicators */}
        {totalImages > 1 && (
          <div className={styles.dots}>
            {images.map((_, i) => (
              <button
                key={i}
                className={`${styles.dot} ${i === currentIndex ? styles.dotActive : ''}`}
                onClick={() => setCurrentIndex(i)}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {totalImages > 1 && (
        <div className={styles.thumbnailStrip}>
          {images.map((img, i) => (
            <button
              key={img.id}
              className={`${styles.thumbnail} ${i === currentIndex ? styles.thumbnailActive : ''}`}
              onClick={() => setCurrentIndex(i)}
            >
              <img src={img.url} alt={`Thumbnail ${i + 1}`} />
              {img.isCover && <span className={styles.thumbCoverDot} />}
            </button>
          ))}
        </div>
      )}

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleUpload}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChangeCover}
      />
    </div>
  )
}