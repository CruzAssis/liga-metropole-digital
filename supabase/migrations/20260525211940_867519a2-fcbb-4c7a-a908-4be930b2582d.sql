
-- =====================================================
-- 2. Tabela team_members (Diretor / Jogador) e team_supporters (Torcedor)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL CHECK (role IN ('director','player')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id, role)
);

-- 1 diretor por usuário, no máximo
CREATE UNIQUE INDEX IF NOT EXISTS team_members_one_director_per_user
  ON public.team_members (user_id)
  WHERE role = 'director';

CREATE INDEX IF NOT EXISTS team_members_team_idx ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON public.team_members(user_id);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.team_supporters (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_supporters_team_idx ON public.team_supporters(team_id);
ALTER TABLE public.team_supporters ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. Helpers SECURITY DEFINER (sem recursão de RLS)
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_team_director(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
      AND role = 'director' AND accepted_at IS NOT NULL
  ) OR EXISTS (
    -- compat: manager_id "legado" continua valendo como diretor
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND manager_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id
      AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = _team_id AND manager_id = _user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_team_director(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;

-- =====================================================
-- 4. Backfill: cada manager_id atual vira director em team_members
-- =====================================================

INSERT INTO public.team_members (team_id, user_id, role, accepted_at)
SELECT id, manager_id, 'director'::public.app_role, now()
FROM public.teams
WHERE manager_id IS NOT NULL
ON CONFLICT (team_id, user_id, role) DO NOTHING;

-- =====================================================
-- 5. Trigger handle_new_user: parar de atribuir team_manager
--    automaticamente. Diretor passa a ser concedido só
--    quando o usuário inscreve/aprova um time.
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, cpf)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    coalesce(NEW.raw_user_meta_data->>'cpf', '')
  );
  -- Nenhuma role automática. user_roles é populado por fluxo explícito:
  --   * Diretor: ao inscrever um time (server fn cria team_members)
  --   * Jogador: ao aceitar convite do Diretor
  --   * Torcedor: ao escolher time em team_supporters
  RETURN NEW;
END;
$function$;

-- =====================================================
-- 6. RLS de team_members
-- =====================================================

CREATE POLICY "team_members admin all"
  ON public.team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Cada usuário lê seus próprios vínculos
CREATE POLICY "team_members self read"
  ON public.team_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Diretor do time lê o elenco do time
CREATE POLICY "team_members director read"
  ON public.team_members FOR SELECT TO authenticated
  USING (public.is_team_director(auth.uid(), team_id));

-- Diretor convida (insert) membros para o seu time
CREATE POLICY "team_members director invite"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_director(auth.uid(), team_id)
    AND role IN ('player')  -- diretor só convida jogadores
  );

-- Jogador aceita/atualiza só o próprio vínculo (accepted_at)
CREATE POLICY "team_members self update"
  ON public.team_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Diretor remove jogador do time; jogador remove a si mesmo
CREATE POLICY "team_members director or self delete"
  ON public.team_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_team_director(auth.uid(), team_id));

-- =====================================================
-- 7. RLS de team_supporters
-- =====================================================

CREATE POLICY "team_supporters admin all"
  ON public.team_supporters FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "team_supporters public read"
  ON public.team_supporters FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "team_supporters self upsert"
  ON public.team_supporters FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_supporters self update"
  ON public.team_supporters FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "team_supporters self delete"
  ON public.team_supporters FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER team_supporters_updated_at
  BEFORE UPDATE ON public.team_supporters
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 8. Hardening: revogar colunas sensíveis de athletes
--    (impede que SELECT público veja CPF hash / last4 / user_id)
-- =====================================================

REVOKE SELECT (cpf_hash, cpf_last4, user_id)
  ON public.athletes FROM anon, authenticated;

-- =====================================================
-- 9. Estender policies de write para aceitar o novo Diretor
--    (mantém compat com manager_id antigo via is_team_director)
-- =====================================================

-- athletes: insert / update por diretor
DROP POLICY IF EXISTS "athletes team manager insert" ON public.athletes;
DROP POLICY IF EXISTS "athletes team manager update" ON public.athletes;

CREATE POLICY "athletes director insert"
  ON public.athletes FOR INSERT TO authenticated
  WITH CHECK (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id));

CREATE POLICY "athletes director update"
  ON public.athletes FOR UPDATE TO authenticated
  USING (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id))
  WITH CHECK (team_id IS NOT NULL AND public.is_team_director(auth.uid(), team_id));

-- teams: update por diretor (mantém policy "manager updates own" via compat)
CREATE POLICY "teams director updates"
  ON public.teams FOR UPDATE TO authenticated
  USING (public.is_team_director(auth.uid(), id))
  WITH CHECK (public.is_team_director(auth.uid(), id));

-- match_events: hardening (separar SELECT do write)
DROP POLICY IF EXISTS "match_events host manager write" ON public.match_events;

CREATE POLICY "match_events director write"
  ON public.match_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.is_team_director(auth.uid(), m.host_team_id)
        AND m.status IN ('scheduled','awaiting_confirmation')
    )
  );

CREATE POLICY "match_events director update"
  ON public.match_events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.is_team_director(auth.uid(), m.host_team_id)
        AND m.status IN ('scheduled','awaiting_confirmation')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.is_team_director(auth.uid(), m.host_team_id)
        AND m.status IN ('scheduled','awaiting_confirmation')
    )
  );

CREATE POLICY "match_events director delete"
  ON public.match_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_events.match_id
        AND public.is_team_director(auth.uid(), m.host_team_id)
        AND m.status IN ('scheduled','awaiting_confirmation')
    )
  );

-- mbov: estender para diretor (mantém compat)
DROP POLICY IF EXISTS "mbov voter insert" ON public.match_best_opponent_votes;
CREATE POLICY "mbov voter insert"
  ON public.match_best_opponent_votes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_team_director(auth.uid(), voter_team_id)
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_best_opponent_votes.match_id
        AND m.status = ANY (ARRAY['scheduled','awaiting_confirmation','confirmed'])
        AND (m.host_team_id = voter_team_id OR m.visitor_team_id = voter_team_id)
        AND (m.host_team_id = opponent_team_id OR m.visitor_team_id = opponent_team_id)
        AND voter_team_id <> opponent_team_id
    )
  );

DROP POLICY IF EXISTS "mbov voter update" ON public.match_best_opponent_votes;
CREATE POLICY "mbov voter update"
  ON public.match_best_opponent_votes FOR UPDATE TO authenticated
  USING (public.is_team_director(auth.uid(), voter_team_id))
  WITH CHECK (public.is_team_director(auth.uid(), voter_team_id));

DROP POLICY IF EXISTS "mbov opponent identify" ON public.match_best_opponent_votes;
CREATE POLICY "mbov opponent identify"
  ON public.match_best_opponent_votes FOR UPDATE TO authenticated
  USING (public.is_team_director(auth.uid(), opponent_team_id))
  WITH CHECK (public.is_team_director(auth.uid(), opponent_team_id));
