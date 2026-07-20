
-- Tabela central de notificações (email + whatsapp)
CREATE TABLE IF NOT EXISTS public.notificacoes_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('team_approved','jogo_agendado','sumula_disponivel','sumula_prazo_alerta','destaque_publicado','broadcast')),
  canal TEXT NOT NULL CHECK (canal IN ('email','whatsapp')),
  destinatario_id UUID NULL,
  destinatario_email TEXT NULL,
  destinatario_nome TEXT NULL,
  destinatario_phone TEXT NULL,
  assunto TEXT NULL,
  corpo_preview TEXT NULL,
  whatsapp_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviado','falhou')),
  erro_mensagem TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_template TEXT NULL,
  enviado_em TIMESTAMPTZ NULL,
  send_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_log_created_at ON public.notificacoes_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_status ON public.notificacoes_log (status);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_tipo ON public.notificacoes_log (tipo);
CREATE INDEX IF NOT EXISTS idx_notificacoes_log_canal ON public.notificacoes_log (canal);

GRANT SELECT, INSERT, UPDATE ON public.notificacoes_log TO authenticated;
GRANT ALL ON public.notificacoes_log TO service_role;

ALTER TABLE public.notificacoes_log ENABLE ROW LEVEL SECURITY;

-- Só admin pode ler tudo
CREATE POLICY "Admin can view all notifications"
ON public.notificacoes_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Só admin pode atualizar status manualmente (marcar enviado, reenviar)
CREATE POLICY "Admin can update notifications"
ON public.notificacoes_log FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Só service_role (server functions) grava; usuários comuns não gravam direto
