-- ============================================================================
-- Rate limit da consulta por CPF (/verificar)
--
-- A rota aceitava CPF sem autenticacao e sem limite, e devolvia nome completo,
-- WhatsApp, Instagram, foto e time. O espaco de CPF valido e pequeno o
-- suficiente para varrer: 11 digitos com 2 digitos verificadores = ~1e9
-- combinacoes, e o atacante nao precisa varrer tudo, so a faixa de um estado.
-- Sem limite, a base inteira sai pela porta da frente.
--
-- Aqui fica so o contador. O corte do dado devolvido esta no patch de
-- src/lib/athletes.functions.ts (passa a devolver apenas nome parcial).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.cpf_lookup_attempts (
  id           bigserial PRIMARY KEY,
  ip_hash      text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  found        boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS cpf_lookup_attempts_ip_time_idx
  ON public.cpf_lookup_attempts (ip_hash, attempted_at DESC);

ALTER TABLE public.cpf_lookup_attempts ENABLE ROW LEVEL SECURITY;

-- Ninguem le nem escreve pelo cliente. So o service_role, via server function.
DROP POLICY IF EXISTS "sem acesso pelo cliente" ON public.cpf_lookup_attempts;
CREATE POLICY "sem acesso pelo cliente"
  ON public.cpf_lookup_attempts
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON public.cpf_lookup_attempts FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.cpf_lookup_attempts_id_seq FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Registra a tentativa e devolve se estourou a janela.
-- Chamada com service_role a partir de findAthleteByCpf.
--
-- Janela dupla: 5 tentativas / 10 min corta o teste manual afobado,
-- 30 / 24 h corta a varredura lenta que espera a janela curta expirar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_cpf_lookup_rate_limit(
  _ip_hash        text,
  _short_window   interval DEFAULT '10 minutes',
  _short_max      integer  DEFAULT 5,
  _long_window    interval DEFAULT '24 hours',
  _long_max       integer  DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_short integer;
  n_long  integer;
BEGIN
  IF _ip_hash IS NULL OR length(_ip_hash) < 16 THEN
    RAISE EXCEPTION 'ip_hash ausente ou curto demais' USING ERRCODE = '22023';
  END IF;

  -- Faxina oportunista: mantem a tabela pequena sem depender de cron.
  DELETE FROM public.cpf_lookup_attempts
   WHERE attempted_at < now() - GREATEST(_long_window, interval '24 hours');

  SELECT count(*) INTO n_short
    FROM public.cpf_lookup_attempts
   WHERE ip_hash = _ip_hash AND attempted_at > now() - _short_window;

  SELECT count(*) INTO n_long
    FROM public.cpf_lookup_attempts
   WHERE ip_hash = _ip_hash AND attempted_at > now() - _long_window;

  IF n_short >= _short_max OR n_long >= _long_max THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'retry_after_seconds',
        CASE WHEN n_short >= _short_max
             THEN EXTRACT(EPOCH FROM _short_window)::int
             ELSE EXTRACT(EPOCH FROM _long_window)::int
        END
    );
  END IF;

  INSERT INTO public.cpf_lookup_attempts (ip_hash) VALUES (_ip_hash);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining_short', _short_max - n_short - 1,
    'remaining_long',  _long_max  - n_long  - 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_cpf_lookup_rate_limit(text, interval, integer, interval, integer)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.check_cpf_lookup_rate_limit(text, interval, integer, interval, integer) IS
  'Rate limit por hash de IP para a consulta publica de CPF em /verificar. Executada apenas com service_role.';
