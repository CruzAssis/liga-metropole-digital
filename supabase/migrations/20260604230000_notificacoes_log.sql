-- Migration: notificacoes_log table
-- Tracks all email/WhatsApp notification sends

-- Create enums
DO $$ BEGIN
  CREATE TYPE notificacao_tipo AS ENUM (
    'team_approved',
    'jogo_agendado',
    'sumula_disponivel',
    'sumula_prazo_alerta',
    'destaque_publicado'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notificacao_canal AS ENUM ('email', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notificacao_status AS ENUM ('pendente', 'enviado', 'falhou');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main notifications log table
CREATE TABLE IF NOT EXISTS notificacoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo notificacao_tipo NOT NULL,
  canal notificacao_canal NOT NULL DEFAULT 'email',
  destinatario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  destinatario_email TEXT,
  destinatario_nome TEXT,
  destinatario_phone TEXT,
  assunto TEXT,
  corpo_preview TEXT, -- first 200 chars of body for display
  status notificacao_status NOT NULL DEFAULT 'pendente',
  erro_mensagem TEXT,
  payload JSONB DEFAULT '{}'::jsonb, -- full context: partida_id, time_id, etc.
  whatsapp_template TEXT, -- template name for future WhatsApp integration
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_tipo ON notificacoes_log(tipo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_status ON notificacoes_log(status);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_created_at ON notificacoes_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_destinatario ON notificacoes_log(destinatario_id);

-- RLS
ALTER TABLE notificacoes_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read/write
CREATE POLICY "Admins can do everything on notificacoes_log"
  ON notificacoes_log
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Service role (Edge Functions) can insert
CREATE POLICY "Service role can insert notificacoes_log"
  ON notificacoes_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update notificacoes_log"
  ON notificacoes_log
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can select notificacoes_log"
  ON notificacoes_log
  FOR SELECT
  TO service_role
  USING (true);
