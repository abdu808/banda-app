-- ============================================================
-- نظام البطاقات — مخطط قاعدة البيانات الكامل والمُصلَح
-- يمكن تشغيله على قاعدة بيانات موجودة بأمان
-- ============================================================

-- ===========================
-- 1. الجداول الأساسية
-- ===========================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'distributor' CHECK (role IN ('admin', 'distributor')),
  allowed_projects UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  requires_cards BOOLEAN DEFAULT true,
  cards_per_beneficiary INTEGER DEFAULT 2,
  is_public BOOLEAN DEFAULT false,
  passcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- إضافة القيد بعد إنشاء الجدول (يدعم جميع الحالات)
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('active', 'paused', 'completed', 'closed'));

CREATE TABLE IF NOT EXISTS beneficiaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  identity_number TEXT NOT NULL,
  phone_number TEXT,
  assigned_cards_count INTEGER,
  field_notes TEXT,
  proxy_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received')),
  received_at TIMESTAMP WITH TIME ZONE,
  distributed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  distributed_by_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, identity_number)
);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  value NUMERIC DEFAULT 500,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used')),
  assigned_to UUID REFERENCES beneficiaries(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, card_number)
);

-- ===========================
-- 2. الفهارس
-- ===========================

CREATE INDEX IF NOT EXISTS idx_beneficiaries_project  ON beneficiaries(project_id);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_identity ON beneficiaries(identity_number);
CREATE INDEX IF NOT EXISTS idx_beneficiaries_status   ON beneficiaries(status);
CREATE INDEX IF NOT EXISTS idx_cards_project          ON cards(project_id);
CREATE INDEX IF NOT EXISTS idx_cards_number           ON cards(card_number);
CREATE INDEX IF NOT EXISTS idx_cards_status           ON cards(status);
CREATE INDEX IF NOT EXISTS idx_cards_assigned         ON cards(assigned_to);

-- ===========================
-- 3. Trigger إنشاء Profile تلقائي
-- ===========================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'distributor'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================
-- 4. تفعيل Row Level Security
-- ===========================

ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficiaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards        ENABLE ROW LEVEL SECURITY;

-- ===========================
-- 5. Helper Functions (محسنة لتجاوز حلقات RLS المفرغة)
-- ===========================

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  matching_role TEXT;
BEGIN
  SELECT role INTO matching_role FROM profiles WHERE id = auth.uid() LIMIT 1;
  RETURN matching_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_allowed_projects()
RETURNS UUID[] AS $$
DECLARE
  projects UUID[];
BEGIN
  SELECT allowed_projects INTO projects FROM profiles WHERE id = auth.uid() LIMIT 1;
  RETURN projects;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ===========================
-- 6. سياسات Profiles
-- ===========================

DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles"     ON profiles;
DROP POLICY IF EXISTS "Admins can manage profiles"       ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"     ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_all_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;

-- كل مستخدم يقرأ ملفه الشخصي فقط
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- لا نحتاج سياسات إضافية للمديرين لأن الإدارة تتم عبر الواجهة الخلفية (Backend API)


-- ===========================
-- 7. سياسات Projects
-- ===========================

-- دالة مساعدة لجلب المشاريع المسموحة بدون الانقطاع بسبب RLS
CREATE OR REPLACE FUNCTION public.get_my_allowed_projects()
RETURNS UUID[] AS $$
  SELECT allowed_projects FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Admins can manage projects"            ON projects;
DROP POLICY IF EXISTS "Distributors can read allowed projects" ON projects;
DROP POLICY IF EXISTS "projects_all_admin" ON projects;
DROP POLICY IF EXISTS "projects_select_distributor" ON projects;

-- المدير له صلاحية كاملة
CREATE POLICY "projects_all_admin"
  ON projects FOR ALL
  USING (public.get_my_role() = 'admin');

-- الموزع يقرأ المشاريع العامة أو التي لديه صلاحية عليها
CREATE POLICY "projects_select_distributor"
  ON projects FOR SELECT
  USING (
    is_public = true
    OR id = ANY(public.get_my_allowed_projects())
  );

-- ===========================
-- 8. سياسات Beneficiaries
-- ===========================

DROP POLICY IF EXISTS "Admins can manage beneficiaries"                          ON beneficiaries;
DROP POLICY IF EXISTS "Distributors can access beneficiaries of allowed projects" ON beneficiaries;
DROP POLICY IF EXISTS "beneficiaries_all_admin"       ON beneficiaries;
DROP POLICY IF EXISTS "beneficiaries_all_distributor" ON beneficiaries;

-- المدير له صلاحية كاملة
CREATE POLICY "beneficiaries_all_admin"
  ON beneficiaries FOR ALL
  USING (public.get_my_role() = 'admin');

-- الموزع يصل للمستفيدين ضمن مشاريعه المسموحة
CREATE POLICY "beneficiaries_all_distributor"
  ON beneficiaries FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE is_public = true
         OR id = ANY(public.get_my_allowed_projects())
    )
  );

-- ===========================
-- 9. سياسات Cards
-- ===========================

DROP POLICY IF EXISTS "Admins can manage cards"                            ON cards;
DROP POLICY IF EXISTS "Distributors can process cards of allowed projects" ON cards;
DROP POLICY IF EXISTS "cards_all_admin"       ON cards;
DROP POLICY IF EXISTS "cards_all_distributor" ON cards;

-- المدير له صلاحية كاملة
CREATE POLICY "cards_all_admin"
  ON cards FOR ALL
  USING (public.get_my_role() = 'admin');

-- الموزع يصل للبطاقات ضمن مشاريعه المسموحة
CREATE POLICY "cards_all_distributor"
  ON cards FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects
      WHERE is_public = true
         OR id = ANY(public.get_my_allowed_projects())
    )
  );
