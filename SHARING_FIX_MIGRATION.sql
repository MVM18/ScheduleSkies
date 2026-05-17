-- ============================================================================
-- SHARING & COLLABORATION FIX: RLS POLICY UPDATES + NEW TABLES
-- Run this in Supabase SQL Editor (Database > SQL Editor > New Query)
--
-- ROOT CAUSE: Three RLS policies prevent collaborators from seeing shared
-- events in the "Shared with me" tab. The tables are correct; only the
-- policies need updating.
-- ============================================================================

-- ============================================================================
-- 1. EVENTS TABLE — Let collaborators SELECT shared events
-- ============================================================================
CREATE POLICY "Collaborators can view shared events"
  ON public.events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = events.id
        AND sc.user_id = auth.uid()
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- ============================================================================
-- 2. SHARE_COLLABORATORS TABLE — Let users read their OWN collaborator records
-- ============================================================================
CREATE POLICY "Users can view their own collaborator records"
  ON public.share_collaborators FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================================
-- 3. ITINERARY_ACTIVITIES TABLE — Let collaborators read shared event activities
-- ============================================================================
CREATE POLICY "Collaborators can view shared event activities"
  ON public.itinerary_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = itinerary_activities.event_id
        AND sc.user_id = auth.uid()
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- ============================================================================
-- 4. ITINERARY_ACTIVITIES TABLE — Let edit-role collaborators modify activities
-- ============================================================================
CREATE POLICY "Collaborators with edit role can insert activities"
  ON public.itinerary_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = itinerary_activities.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

CREATE POLICY "Collaborators with edit role can update activities"
  ON public.itinerary_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = itinerary_activities.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

CREATE POLICY "Collaborators with edit role can delete activities"
  ON public.itinerary_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = itinerary_activities.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- ============================================================================
-- 5. BUDGET TABLES — Let collaborators view and modify budgets/expenses
-- ============================================================================

-- event_budgets: collaborators can view
CREATE POLICY "Collaborators can view shared event budgets"
  ON public.event_budgets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = event_budgets.event_id
        AND sc.user_id = auth.uid()
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- event_budgets: edit-role collaborators can insert/update
CREATE POLICY "Collaborators with edit can manage budgets"
  ON public.event_budgets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = event_budgets.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = event_budgets.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- event_expenses: collaborators can view
CREATE POLICY "Collaborators can view shared event expenses"
  ON public.event_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = event_expenses.event_id
        AND sc.user_id = auth.uid()
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- event_expenses: edit-role collaborators can manage
CREATE POLICY "Collaborators with edit can manage expenses"
  ON public.event_expenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = event_expenses.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_shares es
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE es.event_id = event_expenses.event_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- expense_splits: collaborators can view
CREATE POLICY "Collaborators can view shared expense splits"
  ON public.expense_splits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_expenses ex
      JOIN public.event_shares es ON es.event_id = ex.event_id
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE ex.id = expense_splits.expense_id
        AND sc.user_id = auth.uid()
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- expense_splits: edit-role collaborators can manage
CREATE POLICY "Collaborators with edit can manage splits"
  ON public.expense_splits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.event_expenses ex
      JOIN public.event_shares es ON es.event_id = ex.event_id
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE ex.id = expense_splits.expense_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_expenses ex
      JOIN public.event_shares es ON es.event_id = ex.event_id
      JOIN public.share_collaborators sc ON sc.share_id = es.id
      WHERE ex.id = expense_splits.expense_id
        AND sc.user_id = auth.uid()
        AND es.role = 'edit'
        AND (es.expires_at IS NULL OR es.expires_at > now())
    )
  );

-- ============================================================================
-- 6. ACCESS REQUESTS TABLE — viewers can request edit access from owners
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.access_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id        UUID NOT NULL REFERENCES public.event_shares(id) ON DELETE CASCADE,
  event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  owner_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requester_name  TEXT NOT NULL DEFAULT 'Guest',
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
  created_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

-- Owner can view and manage requests for their events
CREATE POLICY "Owner manages access requests"
  ON public.access_requests FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Requester can view their own requests
CREATE POLICY "Requester views own requests"
  ON public.access_requests FOR SELECT
  USING (auth.uid() = requester_id);

-- Anyone can insert (request access)
CREATE POLICY "Anyone can submit access request"
  ON public.access_requests FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- SELECT * FROM public.access_requests LIMIT 5;
-- SELECT * FROM events WHERE id = '<shared_event_id>';  -- as collaborator
-- SELECT * FROM share_collaborators WHERE user_id = auth.uid();
-- SELECT * FROM itinerary_activities WHERE event_id = '<shared_event_id>';
-- SELECT * FROM event_budgets WHERE event_id = '<shared_event_id>';
-- SELECT * FROM event_expenses WHERE event_id = '<shared_event_id>';
