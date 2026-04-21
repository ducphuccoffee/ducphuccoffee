CREATE TABLE IF NOT EXISTS public.tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  type        text NOT NULL,
  status      text NOT NULL DEFAULT 'todo',
  ref_id      uuid,
  ref_type    text,
  assigned_to uuid REFERENCES auth.users(id),
  created_by  uuid REFERENCES auth.users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_status_check CHECK (status IN ('todo','in_progress','done','cancelled'))
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage tasks" ON public.tasks;

CREATE POLICY "org members can manage tasks"
  ON public.tasks
  FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_tasks_org_id      ON public.tasks(org_id);
CREATE INDEX IF NOT EXISTS idx_tasks_ref_id      ON public.tasks(ref_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks(assigned_to);
