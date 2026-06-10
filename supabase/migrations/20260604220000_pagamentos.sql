-- ================================================================
-- Gestão de Pagamentos — Liga Metrópole Digital
-- feat: payment management system
-- ================================================================

-- Enum para status de pagamento
DO $$ BEGIN
CREATE TYPE public.pagamento_status AS ENUM ('pendente', 'pago', 'atrasado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Enum para método de pagamento
DO $$ BEGIN
CREATE TYPE public.pagamento_metodo AS ENUM ('pix', 'outro');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tabela principal de pagamentos
CREATE TABLE IF NOT EXISTS public.pagamentos (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    time_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    competicao_id uuid REFERENCES public.competitions(id) ON DELETE SET NULL,
    mes_referencia date NOT NULL,
    valor numeric(10,2) NOT NULL DEFAULT 0,
    status public.pagamento_status NOT NULL DEFAULT 'pendente',
    data_pagamento timestamptz,
    metodo public.pagamento_metodo,
    observacoes text,
    marcado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT uq_pagamento_time_mes UNIQUE (time_id, mes_referencia)
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_pagamentos_time_id ON public.pagamentos(time_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_mes ON public.pagamentos(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_pagamentos_status ON public.pagamentos(status);
CREATE INDEX IF NOT EXISTS idx_pagamentos_competicao ON public.pagamentos(competicao_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_pagamentos_updated_at ON public.pagamentos;
CREATE TRIGGER set_pagamentos_updated_at
BEFORE UPDATE ON public.pagamentos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

-- Admins podem tudo (via user_roles)
DROP POLICY IF EXISTS "Admin full access pagamentos" ON public.pagamentos;
CREATE POLICY "Admin full access pagamentos"
ON public.pagamentos FOR ALL
USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Diretores podem ver apenas os pagamentos do próprio time
DROP POLICY IF EXISTS "Director read own team pagamentos" ON public.pagamentos;
CREATE POLICY "Director read own team pagamentos"
ON public.pagamentos FOR SELECT
USING (
    time_id IN (
      SELECT id FROM public.teams WHERE manager_id = auth.uid()
      UNION
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND role = 'director'
      AND accepted_at IS NOT NULL
    )
  );

-- View materializada auxiliar: status atualizado automaticamente
CREATE OR REPLACE VIEW public.pagamentos_com_status AS
SELECT
  p.*,
  CASE
    WHEN p.status = 'pago' THEN 'pago'::text
    WHEN p.status = 'pendente'
      AND (CURRENT_DATE > (p.mes_referencia + INTERVAL '30 days')::date)
    THEN 'atrasado'::text
    ELSE p.status::text
  END AS status_calculado,
  CASE
    WHEN p.status = 'pendente'
      AND (CURRENT_DATE > (p.mes_referencia + INTERVAL '30 days')::date)
    THEN CURRENT_DATE - (p.mes_referencia + INTERVAL '30 days')::date
    ELSE 0
  END AS dias_atraso
FROM public.pagamentos p;
