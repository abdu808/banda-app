-- حذف سياسات القراءة المعقدة القديمة
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;

-- السماح لجميع المستخدمين المسجلين بقراءة الملفات الشخصية
CREATE POLICY "profiles_read_all"
  ON profiles FOR SELECT
  USING (auth.role() = 'authenticated');
