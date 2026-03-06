-- Drop all related policies that might cause loops
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 1. الموزع يقرأ ملفه الشخصي فقط
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- (لا نحتاج لسياسات للمدير هنا لأن إدارة المستخدمين تتم عبر API بالخلفية باستخدام service_role)

-- 2. دالة محسنة وآمنة لجلب الدور بدون لوب
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  matching_role TEXT;
BEGIN
  -- استخدام Bypass RLS داخل الدالة
  SELECT role INTO matching_role FROM profiles WHERE id = auth.uid() LIMIT 1;
  RETURN matching_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. دالة محسنة لجلب المشاريع المسموحة بدون لوب
CREATE OR REPLACE FUNCTION public.get_my_allowed_projects()
RETURNS UUID[] AS $$
DECLARE
  projects UUID[];
BEGIN
  SELECT allowed_projects INTO projects FROM profiles WHERE id = auth.uid() LIMIT 1;
  RETURN projects;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
