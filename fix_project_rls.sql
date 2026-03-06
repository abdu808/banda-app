CREATE OR REPLACE FUNCTION public.get_my_allowed_projects()
RETURNS UUID[] AS $$
  SELECT allowed_projects FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "projects_select_distributor" ON projects;
CREATE POLICY "projects_select_distributor"
  ON projects FOR SELECT
  USING (
    is_public = true
    OR id = ANY(public.get_my_allowed_projects())
  );

DROP POLICY IF EXISTS "beneficiaries_all_distributor" ON beneficiaries;
CREATE POLICY "beneficiaries_all_distributor"
  ON beneficiaries FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE is_public = true
         OR id = ANY(public.get_my_allowed_projects())
    )
  );

DROP POLICY IF EXISTS "cards_all_distributor" ON cards;
CREATE POLICY "cards_all_distributor"
  ON cards FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE is_public = true
         OR id = ANY(public.get_my_allowed_projects())
    )
  );
