## Escopo desta fase

Implementar o módulo **Atletas + ID Metropole** do documento (seções 2.1, 5 — tabela `atletas`, 7 — `/verificar` e `/atletas`, 8 — funções `hash-cpf` e `buscar-atleta-cpf`, 12 — `<VerifiedSeal>`, `<AtletaCard>`, `<IDMetropoleCard>`).

Decisões já aprovadas:
- Manter schema atual em inglês; **adicionar** apenas o que falta.
- Hash/busca de CPF via `createServerFn` (não Edge Function).
- Nada de migração destrutiva nas tabelas existentes (teams/matches/competitions intactos).

Fora desta fase (próximas iterações): páginas públicas de ranking/resultados/agenda, súmula digital, torcidômetro, premiações, refresh de identidade visual (#0A0A0A + textura).

---

## 1. Banco de dados (migration aditiva)

Nova tabela `athletes` (mantém convenção em inglês do projeto):

```
athletes (
  id uuid pk,
  team_id uuid references teams(id) on delete set null,  -- time atual
  full_name text,
  nickname text,
  position text,                          -- goleiro/zagueiro/...
  photo_url text,
  cpf_hash text unique not null,          -- bcrypt, nunca em claro
  cpf_last4 text not null,                -- últimos 4 dígitos para UX de busca
  verified boolean default false,
  verified_at timestamptz,
  whatsapp text,
  instagram_handle text,
  user_id uuid references auth.users(id), -- preenchido ao auto-verificar
  created_at, updated_at
)
```

Índice em `team_id`, `verified`, `cpf_last4`.

RLS:
- `select` público apenas das colunas não sensíveis (via view `public_athletes` ou policy direta — colunas `cpf_hash`/`whatsapp` ficam ocultas no client lendo apenas via server fn).
- `insert/update` pelo manager do time (`teams.manager_id = auth.uid()`).
- `update` pelo próprio atleta após verificação (`user_id = auth.uid()`).
- `all` para admin.

Trigger `updated_at`.

## 2. Server functions (`src/lib/athletes.functions.ts`)

- `preRegisterAthletes({ cpfs: string[] })` — manager do time autenticado; valida cada CPF (dígito verificador), gera bcrypt hash, insere `athletes` com `team_id = time do manager`, `verified=false`. Retorna `{ created, skipped_duplicates }`.
- `findAthleteByCpf({ cpf })` — público; valida CPF, busca por `cpf_last4`, faz `bcrypt.compare` nos candidatos, retorna atleta SEM `cpf_hash` ou 404.
- `verifyAthlete({ cpf, photo_url, whatsapp, instagram })` — autenticado; valida + bcrypt.compare, seta `verified=true`, `verified_at=now()`, `user_id=auth.uid()`, grava dados.
- `listTeamAthletes({ team_id })` — manager do time ou admin.

Validação Zod em todos. CPF helpers em `src/lib/cpf.ts` (mascara, valida dígito).

Dependência: `bun add bcryptjs` (puro JS, compatível com Worker).

## 3. Componentes UI

`src/components/athletes/`:
- `VerifiedSeal.tsx` — círculo `#007BFF` com check branco, absolute bottom-right do avatar container. Props: `size`.
- `Avatar.tsx` (ou estende shadcn) — exibe foto OU iniciais em Bebas Neue + Selo se `verified`.
- `AtletaCard.tsx` — card escuro com avatar+selo, apelido, time, posição, stats placeholder (0 gols / 0 assist enquanto não temos `goals`/`assists`).
- `IDMetropoleCard.tsx` — cartão visual do perfil completo do atleta (usado em modal e em `/perfil-atleta`).

## 4. Páginas

- `src/routes/atletas.tsx` (pública) — grid de `AtletaCard` lendo todos os atletas; sub-tabs preparadas (Artilharia/Assistências/Nota — desabilitadas com chip "em breve" até existir tabela `goals`). Clique abre modal com `IDMetropoleCard`.
- `src/routes/verificar.tsx` (pública) — input de CPF com máscara, validação no submit, chama `findAthleteByCpf`. Se achado: exibe dados pré-cadastrados, formulário (upload foto via bucket `team-logos` ou novo bucket `athletes`, whatsapp, instagram), botão "Ativar meu ID Metropole" que chama `verifyAthlete`. Toast de sucesso → redirect `/atletas`.
- `src/routes/_authenticated/minha-conta.tsx` (edição) — adicionar seção "Pré-cadastrar atletas (CPFs)": textarea com 1 CPF por linha, botão chama `preRegisterAthletes`. Lista atletas do time com chip verde/âmbar (Verificado / Pendente).

Sidebar (`AppSidebar.tsx`): adicionar item público "Atletas" → `/atletas`. Adicionar "Verificar ID" no header público.

## 5. Storage

Novo bucket público `athlete-photos` (path `{athlete_id}/{filename}`), policy: insert pelo `user_id` do atleta verificado OU manager do time. Limite 2MB, mime `image/*`.

## 6. Migration de seed (opcional)

Não inserir dados fake automaticamente — apenas script comentado em SQL anexado para o admin testar.

---

## Detalhes técnicos

- `bcryptjs` (não `bcrypt` nativo) por causa do runtime Worker.
- `cpf_last4` é necessário porque bcrypt não permite busca direta — usamos `last4` como índice e fazemos compare nos candidatos. Caso de colisão raríssimo (≤10 candidatos).
- `findAthleteByCpf` é público, não usa `requireSupabaseAuth`; chama `supabaseAdmin` internamente mas só retorna campos seguros (`id, nickname, full_name, team_id, position, verified`).
- `verifyAthlete` exige sessão autenticada (usuário logado quer vincular o atleta a si).
- Atualizar `src/integrations/supabase/types.ts` é automático após migration aprovada.
- Rotas dentro de `_authenticated/admin/*` continuam intactas.

## Ordem de execução após aprovação

1. Migration (tabela + RLS + bucket + policies).
2. `bun add bcryptjs @types/bcryptjs`.
3. `src/lib/cpf.ts` + `src/lib/athletes.functions.ts`.
4. Componentes (`VerifiedSeal`, `AtletaCard`, `IDMetropoleCard`).
5. Rotas `/atletas` e `/verificar` + sidebar.
6. Seção de pré-cadastro em `/minha-conta`.
7. Verificação manual no preview.

## Itens NÃO incluídos (intencionalmente)

- Cor base ainda `#1A1A1A` (refresh visual fica para outra fase).
- Sem `goals`/`assists`/`fair_play` — stats no card mostram 0/em breve.
- Sem realtime nem notificações.
- Sem mudança no fluxo de sorteio/triagem existente.
