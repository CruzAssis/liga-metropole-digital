-- ============================================================================
-- LGPD — exclusao de conta (art. 18, VI)
--
-- Corrige o bug em que o frontend chamava public.request_account_deletion(),
-- a funcao nao existia, o RPC falhava e o usuario ainda assim via a mensagem
-- "sua conta sera removida". Confirmacao falsa de exclusao e pior que nao ter
-- o recurso.
--
-- Estrategia: ANONIMIZACAO, nao DELETE em cascata.
-- Gol, cartao e placar de partida homologada sao registro esportivo da
-- competicao e nao podem sumir da tabela depois do jogo. O que sai e o dado
-- pessoal: nome, CPF, telefone, foto, Instagram. O atleta vira "Atleta
-- removido" na artilharia; o gol continua contado para o time.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Trilha de auditoria do pedido (LGPD exige poder demonstrar atendimento)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  anonymized_at     timestamptz,
  auth_purged_at    timestamptz,
  profiles_hit      integer NOT NULL DEFAULT 0,
  athletes_hit      integer NOT NULL DEFAULT 0,
  UNIQUE (user_id)
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- O titular ve o proprio pedido (comprovante). Ninguem mais le pelo cliente.
DROP POLICY IF EXISTS "titular le o proprio pedido" ON public.account_deletion_requests;
CREATE POLICY "titular le o proprio pedido"
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON public.account_deletion_requests FROM anon, authenticated;
GRANT SELECT (id, user_id, requested_at, anonymized_at, auth_purged_at)
  ON public.account_deletion_requests TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. A funcao chamada pelo frontend
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid            uuid := auth.uid();
  blocking_team  text;
  n_profiles     integer := 0;
  n_athletes     integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Nao autenticado' USING ERRCODE = '28000';
  END IF;

  -- Trava de integridade da competicao: um time em campeonato em andamento
  -- nao pode ficar sem responsavel. O diretor precisa transferir o time antes.
  SELECT t.name INTO blocking_team
    FROM public.teams t
    LEFT JOIN public.competitions c ON c.id = t.competition_id
   WHERE t.manager_id = uid
     AND t.status IN ('approved', 'pending')
     AND COALESCE(c.status, 'draft') IN ('group_stage', 'knockout', 'registration', 'draft')
   LIMIT 1;

  IF blocking_team IS NOT NULL THEN
    RAISE EXCEPTION
      'Voce e o responsavel pelo time "%" em uma competicao ativa. Transfira a direcao do time para outro diretor antes de excluir a conta.',
      blocking_team
      USING ERRCODE = 'P0001';
  END IF;

  -- --- Dado pessoal no perfil -------------------------------------------
  UPDATE public.profiles
     SET full_name     = 'Usuario removido',
         nickname      = NULL,
         cpf           = NULL,
         phone         = NULL,
         whatsapp      = NULL,
         date_of_birth = NULL,
         avatar_url    = NULL,
         club_name     = NULL,
         position      = NULL,
         director_role = NULL
   WHERE id = uid;
  GET DIAGNOSTICS n_profiles = ROW_COUNT;

  -- --- Dado pessoal na ficha de atleta ----------------------------------
  -- cpf_hash/cpf_last4 saem: sem eles o CPF nao e mais consultavel nem
  -- confirmavel por forca bruta em /verificar.
  UPDATE public.athletes
     SET full_name         = 'Atleta removido',
         nickname          = 'Atleta removido',
         cpf_hash          = NULL,
         cpf_last4         = NULL,
         whatsapp          = NULL,
         instagram_handle  = NULL,
         photo_url         = NULL,
         verified          = false,
         verified_at       = NULL,
         user_id           = NULL
   WHERE user_id = uid;
  GET DIAGNOSTICS n_athletes = ROW_COUNT;

  -- --- Vinculos que nao sao registro esportivo --------------------------
  DELETE FROM public.team_members    WHERE user_id = uid;
  DELETE FROM public.user_roles      WHERE user_id = uid;
  DELETE FROM public.team_supporters WHERE user_id = uid;
  DELETE FROM public.supporter_votes WHERE user_id = uid;

  -- Avaliacao de arbitro: a nota fica (media da arbitragem), o autor sai.
  DELETE FROM public.referee_ratings WHERE rater_user_id = uid;

  -- --- Bloqueia o login e derruba as sessoes abertas --------------------
  UPDATE auth.users
     SET banned_until = 'infinity'::timestamptz
   WHERE id = uid;

  DELETE FROM auth.sessions   WHERE user_id = uid;
  DELETE FROM auth.refresh_tokens WHERE user_id = uid::text;

  -- --- Comprovante ------------------------------------------------------
  INSERT INTO public.account_deletion_requests (user_id, anonymized_at, profiles_hit, athletes_hit)
  VALUES (uid, now(), n_profiles, n_athletes)
  ON CONFLICT (user_id) DO UPDATE
    SET requested_at  = now(),
        anonymized_at = now(),
        profiles_hit  = EXCLUDED.profiles_hit,
        athletes_hit  = EXCLUDED.athletes_hit;

  RETURN jsonb_build_object(
    'ok', true,
    'anonymized_at', now(),
    'profiles', n_profiles,
    'athletes', n_athletes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;

COMMENT ON FUNCTION public.request_account_deletion() IS
  'LGPD art. 18 VI. Anonimiza o dado pessoal do titular autenticado, apaga os vinculos, bane o login e registra o comprovante. O registro esportivo (gols, cartoes, placares) e preservado sem identificacao pessoal.';
