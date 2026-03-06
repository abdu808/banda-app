-- إضافة أعمدة تتبع الموزع إلى جدول المستفيدين
ALTER TABLE beneficiaries 
ADD COLUMN IF NOT EXISTS distributed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS distributed_by_name TEXT;
