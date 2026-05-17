-- ============================================================================
-- OWNER ACTIVITIES SELECT POLICY + DATA REPAIR
-- Run in Supabase SQL Editor after SHARING_FIX_MIGRATION.sql
--
-- Ensures event owners see ALL activities on their events (by event_id),
-- including rows created by collaborators with mismatched user_id.
-- ============================================================================

CREATE POLICY "Event owners can view all activities for their events"
  ON public.itinerary_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = itinerary_activities.event_id
        AND e.user_id = auth.uid()
    )
  );

-- Optional: repair collaborator-created rows attributed to wrong user_id
UPDATE itinerary_activities ia
SET user_id = e.user_id
FROM events e
WHERE ia.event_id = e.id
  AND ia.user_id <> e.user_id
  AND ia.user_id IN (
    SELECT sc.user_id FROM share_collaborators sc
    JOIN event_shares es ON es.id = sc.share_id
    WHERE es.event_id = ia.event_id
  );
