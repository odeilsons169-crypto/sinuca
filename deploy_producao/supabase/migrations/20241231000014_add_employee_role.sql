-- =====================================================
-- MIGRATION: Adicionar roles employee e manager ao enum
-- =====================================================

-- Adicionar 'employee' ao enum user_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'employee' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'employee';
  END IF;
END $$;

-- Adicionar 'manager' ao enum user_role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'manager' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')) THEN
    ALTER TYPE user_role ADD VALUE 'manager';
  END IF;
END $$;
