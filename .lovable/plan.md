# Auditoria de RLS e Server Functions — V3 (Diretor / Jogador / Torcedor)

## 1. Estado atual do controle de acesso

- `app_role` enum tem apenas `admin`, `team_manager`, `athlete` (este último não é usado em policy nenhuma). Não existem `player` nem `supporter`.
- Trigger `handle_new_user` atribui `team_manager` a **todo signup**, indistintamente.
- Toda autorização de "dono do time" no banco é feita por `teams.manager_id = auth.uid()` (1 manager = 1 time, hard-coded). Não há tabela N:N de jogadores em times.
- Server functions críticas (`fillSumula`, `getSumulaContext`, `preRegisterAthletes`, `listMyTeamMatches`, `listMyTeamAthletes`) usam `supabaseAdmin` e validam manualmente `teams.manager_id = userId` — **bypassam RLS**.

## 2. As policies atuais impedem Jogador/Torcedor de editar time ou súmula?

Resposta curta: **parcialmente, e por motivo errado** — hoje impedem porque ninguém além do `manager_id` passa nos checks. Mas no momento em que você criar perfis `player`/`supporter`, vão herdar `team_manager` do trigger `handle_new_user` e ganhar permissões de diretor por acidente.

Pontos verificados:

| Superfície | Quem hoje passa | Risco com V3 |
|---|---|---|
| `teams UPDATE` (RLS) | só `manager_id = auth.uid()` | OK desde que `handle_new_user` pare de dar `team_manager` automático |
| `athletes INSERT/UPDATE` (RLS) | manager do `team_id` | OK |
| `match_events ALL` (RLS) | manager do host | OK |
| `mbov INSERT` (RLS) | manager do `voter_team_id` | Bloqueia Jogador de votar pelo seu time (precisa expandir se for desejado) |
| `fillSumula` (server fn) | checa `manager_id = userId` no host | Bloqueia Jogador/Torcedor. OK. |
| `getSumulaContext` | host OR visitor manager OR admin | OK |
| `preRegisterAthletes` | qualquer um com `teams.manager_id = userId` | OK enquanto trigger não distribuir `team_manager` |

**Conclusão:** a vedação só se sustenta se você (a) **parar de atribuir `team_manager` automático no signup** e (b) trocar `team_manager` por uma role explícita `director` atribuída no momento em que o time é aprovado.

## 3. Onde um `team_manager` pode burlar e ler dados de outras equipes

### 3.1. CRÍTICO — `athletes` está com leitura pública e sem máscara

`CREATE POLICY athletes public read ... USING (true)` permite que **qualquer usuário autenticado ou anônimo** faça `select *` em `athletes` e leia:

- `cpf_hash` (bcrypt — alvo de brute-force offline com `cpf_last4` como dica)
- `cpf_last4`
- `whatsapp`, `instagram_handle`
- `user_id` (link com `auth.users`)

Arquivo: `supabase/migrations/...athletes_public_read` (policy atual) — **deve ser substituída por uma view pública** com colunas seguras (`id, full_name, nickname, position, photo_url, verified, team_id`) e a tabela base com `SELECT` restrito a admin + dono.

### 3.2. ALTO — Não existe tabela de cobrança

`competitions.monthly_fee_brl` e `wo_fine_brl` ficam no nível da competição, sem por-time. Não há `team_invoices`/`payments` ainda → não há vazamento hoje, **mas qualquer tabela de cobrança que você adicionar precisa de RLS escopada a `team_id` + `director`/`admin`, nunca leitura pública.**

### 3.3. MÉDIO — `getTeamContact` devolve telefone+e-mail do diretor para qualquer autenticado

Hoje aceitável (só `team_manager` é autenticado). Com `Torcedor` autenticado em escala, qualquer torcedor consulta o telefone pessoal e o e-mail de qualquer diretor adversário. Precisa virar opt-in (`teams.contact_public boolean`) ou exigir `director`/`admin`.

### 3.4. MÉDIO — `listMyTeamMatches` assume "1 time por usuário"

`select ... eq("manager_id", userId).maybeSingle()` falha silenciosamente quando o Jogador estiver atrelado a N times. Precisa virar `select id from team_members where user_id = ... and role in ('director','player')`.

### 3.5. BAIXO — `match_events host manager write` é `FOR ALL`

Policy permissiva: além de INSERT/UPDATE/DELETE também cobre SELECT (sem filtrar). Inofensivo porque a policy `public read` já libera leitura, mas vale restringir para `INSERT, UPDATE, DELETE` por higiene.

## 4. Arquivos que precisam mudar imediatamente

### 4.1. Migrations (banco)

1. **Nova migration — separar roles e quebrar 1:1**
   - `ALTER TYPE app_role ADD VALUE 'director'; ADD VALUE 'player'; ADD VALUE 'supporter';` (deprecar `team_manager` depois)
   - Tabela `team_members (team_id, user_id, role in ('director','player'), accepted_at)` com unique parcial `(user_id) where role='director'` para garantir **1 diretor por usuário**.
   - Tabela `team_supporters (user_id PK, team_id)` — **1 time por torcedor**.
   - Helper SECURITY DEFINER: `is_team_director(_user uuid, _team uuid)`, `is_team_member(_user uuid, _team uuid)`.

2. **Reescrever trigger `handle_new_user`**
   - Não inserir mais `team_manager` automático. Role só é concedida quando time é aprovado (insert em `team_members` com `role='director'`) ou quando o usuário escolhe perfil Jogador/Torcedor.

3. **Refatorar policies que usam `teams.manager_id`**
   - `teams UPDATE/INSERT/SELECT-own`, `athletes INSERT/UPDATE`, `match_events ALL`, `mbov INSERT/UPDATE`, `mbov opponent identify` → trocar `manager_id = auth.uid()` por `public.is_team_director(auth.uid(), team_id)`.

4. **Substituir `athletes public read true`**
   - `DROP POLICY athletes public read;`
   - `CREATE VIEW athletes_public WITH (security_invoker=on) AS SELECT id, team_id, full_name, nickname, position, photo_url, verified FROM athletes;`
   - Nova policy base: `SELECT` apenas para `admin` OR `is_team_member(auth.uid(), team_id)` OR `athletes.user_id = auth.uid()`.
   - Trocar todos os `from('athletes').select(...)` públicos em `src/routes/atletas.tsx`, `times.$slug.tsx`, `team-profile.functions.ts`, `athletes.functions.ts` (busca pública) para a view.

5. **Endurecer `competitions`/futuras tabelas de cobrança** com RLS por `team_id` + `director`/`admin` e bloquear leitura pública.

### 4.2. Server functions (TanStack)

| Arquivo | Mudança |
|---|---|
| `src/lib/sumula.functions.ts` → `fillSumula`, `getSumulaContext` | trocar `teams.manager_id = userId` por `is_team_director`. Continuar bloqueando preenchimento pelo visitante. |
| `src/lib/sumula.functions.ts` → `listMyTeamMatches` | usar `team_members` (retornar lista de times do usuário, não `maybeSingle`). |
| `src/lib/athletes.functions.ts` → `preRegisterAthletes`, `listMyTeamAthletes` | idem (resolver `team_id` via `team_members` + `director`). |
| `src/lib/team-profile.functions.ts` → `getTeamContact` | exigir role `director` no mesmo time OU `teams.contact_public = true`, senão devolver só nome. |
| `src/lib/team-profile.functions.ts` → `getTeamPublicProfile` | trocar `from('athletes')` por `from('athletes_public')`. |
| `src/lib/users.functions.ts` | adicionar `director`/`player`/`supporter` ao enum no `setRoleSchema`; manter regra anti-lockout do último admin. |
| `src/lib/draw.functions.ts` | revisar uso de `team_manager` (se houver) — provavelmente só admin, ok. |

### 4.3. Rotas (front)

| Rota | Risco | Ação |
|---|---|---|
| `src/routes/_authenticated/minha-conta.tsx` | assume 1 time por usuário (`team_manager`) | adicionar seletor de time + branch por role (director / player / supporter) |
| `src/routes/_authenticated/inscricao.tsx` | qualquer logado pode inscrever um time | restringir a usuários sem role `director` ativa |
| `src/routes/atletas.tsx`, `src/routes/times.$slug.tsx`, `verificar.tsx` | consultam `athletes` direto pelo cliente, podem expor CPF/whatsapp depois da policy | passar a usar `athletes_public` (view) |
| `src/hooks/use-is-admin.tsx` | só checa admin | criar `use-team-roles` que devolve `{ directorTeamIds, playerTeamIds, supporterTeamId, isAdmin }` |

## 5. Ordem recomendada de execução

1. Migration "team_members + team_supporters + helpers + novos enum values".
2. Reescrever trigger `handle_new_user` para não dar role automática.
3. Migration "view `athletes_public` + restringir policy base" e atualizar leituras públicas no front/server-fn no mesmo passo (build quebra senão).
4. Trocar policies de `teams/athletes/match_events/mbov` para usar `is_team_director`/`is_team_member`.
5. Refatorar server functions listadas em §4.2.
6. Adicionar fluxo de convite Diretor → Jogador (insert em `team_members` pendente + aceite).
7. Adicionar UI de "escolher time" para Torcedor (insert em `team_supporters`).

## 6. Resumo executivo

- **Bloqueio Jogador/Torcedor editar time/súmula:** depende de remover a role automática `team_manager` do trigger. Hoje, qualquer signup vira gestor.
- **Vazamento mais grave hoje:** `athletes public read true` expõe `cpf_hash`, `cpf_last4`, `whatsapp`, `user_id` para anônimos. Corrigir antes de qualquer coisa.
- **Não há tabela de cobrança ainda** — risco é prospectivo; planejar RLS por `team_id` antes de criá-la.
- **Arquivos prioritários:** policies de `athletes`, trigger `handle_new_user`, `sumula.functions.ts`, `athletes.functions.ts`, `team-profile.functions.ts`, `minha-conta.tsx`, `inscricao.tsx`.
