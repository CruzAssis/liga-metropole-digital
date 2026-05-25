
-- ============================================================
-- V3: Perfis isolados (Diretor / Jogador / Torcedor) + hardening
-- ============================================================

-- 1. Novos valores no enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'player';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supporter';
