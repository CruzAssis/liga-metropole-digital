# Auditoria do estado atual — Liga Metrópole

Conferi o código das rotas/serverFn principais contra o schema real do Supabase (tabelas `teams`, `profiles`, `matches`, `match_events`, `match_best_opponent_votes`, `user_roles`, enum `app_role`) e as RLS publicadas. O resumo abaixo separa o que está pronto, o que funciona pela metade e o que está quebrado — com a causa-raiz.

---

## AUTENTICAÇÃO

- ✅ **Login com email/senha** — `src/routes/login.tsx` usa `supabase.auth.signInWithPassword`, valida com Zod e redireciona para `/minha-conta`.
- ✅ **Sessão persiste ao navegar** — `AuthProvider` (`use-auth.tsx`) escuta `onAuthStateChange` e o client persiste em `localStorage`.
- ✅ **Logout manual** — `AppSidebar` chama `signOut()` e navega para `/login`.
- ✅ **Proteção de rotas autenticadas** — `_authenticated.tsx` redireciona para `/login`; `_authenticated/admin.tsx` exige `has_role(admin)`.

## CADASTRO  ❌ quebrado de ponta a ponta

`src/routes/signup.tsx`:

1. Após `auth.signUp`, faz `profiles.upsert({ id, nome_completo, telefone, cpf, is_diretor, is_jogador, is_torcedor })`.
   - A tabela `profiles` **não tem** as colunas `nome_completo`, `telefone`, `is_diretor`, `is_jogador`, `is_torcedor`. As colunas reais são `full_name`, `phone`, `cpf`, `avatar_url`.
   - O trigger `handle_new_user` **já insere** o profile automaticamente a partir do `raw_user_meta_data`. O upsert manual entra em conflito de chave/coluna.
   - Se confirmação de email estiver ligada, ainda não há sessão e a RLS `id = auth.uid()` rejeita o insert.
2. Não cria nenhum registro em `user_roles`. Conforme o `handle_new_user`, o papel "Diretor" só é criado quando o time é inscrito — mas o fluxo de inscrição também está quebrado (ver abaixo), então **ninguém vira diretor de fato**.
3. Redireciona Diretor para `/inscricao` ✅, mas como `is_diretor` é só estado local, qualquer reload perde a intenção.

## INSCRIÇÃO DE TIME  ❌ quebrado

`src/routes/_authenticated/inscricao.tsx` insere em `teams`:
```
{ nome, tipo, cor_primaria, cor_secundaria, grupo, fase_atual, mensalidade_paga }
```
Mas o schema real de `teams` exige `name`, `short_name` (NOT NULL), `manager_id` (NOT NULL), `registration_type` ('host'|'visitor'), `status`, `lado`, `serie`. Resultado:
- O insert falha por **NOT NULL** em `name`, `short_name`, `manager_id`, `registration_type`.
- Também tenta colunas inexistentes (`nome`, `tipo`, `grupo`, `fase_atual`, `mensalidade_paga`, `cor_secundaria`).
- O update de `profiles.time_diretor_id` falha — essa coluna não existe.
- Mesmo se fosse corrigido, falta criar `team_members(role='director')` para o `has_role`/`is_team_director` funcionar.

Consequência: nenhum time consegue ser inscrito, nenhum diretor é vinculado.

## ÁREA DO DIRETOR (`/minha-conta`)  ⚠️ parcial

- ✅ Layout, leitura de `teams` por `manager_id`, badge de status, contato do diretor via `getMyProfile/updateMyProfile` (serverFn).
- ⚠️ Como nenhum time é criado, a página sempre mostra "Você ainda não inscreveu um time".
- ⚠️ Gestão de elenco (`TeamAthletesSection`) e personalização (`TeamCustomizationCard`, `TeamHomeVenueCard`) só renderizam quando `status === 'approved'` — não testáveis sem o fluxo de inscrição.

## ADMIN

- ⚠️ **`/admin/dashboard`** — código está coerente com o schema (`registration_type`, `status`), mas listagem fica vazia enquanto a inscrição estiver quebrada. Não há contadores de "partidas" ou "súmulas" como a especificação pede; só inscrições.
- ❌ **`/admin/triagem`** — consulta `mensalidade_paga`, `tipo`, joina `profiles!profiles_time_diretor_id_fkey(nome_completo,telefone)` e atualiza `grupo`/`mensalidade_paga`. Nenhuma dessas colunas/relacionamentos existe. A query falha; o painel não lista nada e a aprovação não grava.
- ❌ **`/admin/usuarios`** — `setUserRole` é chamado com `role: 'team_manager'`, mas o enum `app_role` é `('admin','director','player','supporter')`. Toggle de "Gestor" sempre falha com violação de enum. Toggle "Admin" funciona.

## SÚMULA DIGITAL (`/partidas/:id`)  ❌ quebrado

`src/routes/partidas.$id.tsx`:
1. Faz `update` direto em `matches` (host_score, visitor_score, status) a partir do client. A tabela `matches` **só tem policy de UPDATE para admin** — qualquer diretor recebe erro de RLS no "Confirmar Placar", "Confirmar", "Contestar".
2. Define `status='placar_lancado' | 'placar_confirmado' | 'agendada' | 'encerrada'`, mas as RLS de `match_events` e `match_best_opponent_votes` só permitem escrita quando `matches.status ∈ ('scheduled','awaiting_confirmation','confirmed')`. Logo, depois do primeiro update (mesmo se a RLS de matches fosse alterada), gols e votos passam a ser rejeitados.
3. Insert em `match_best_opponent_votes` envia `athlete_id=''` (string vazia) quando não há atleta selecionado — quebra cast para uuid; e a tabela `match_events` exige `athlete_id NOT NULL`, então registrar gol "só com nome" também falha.
4. Countdown de 72h é só visual (calcula a partir de `scheduled_at`); não há job/RLS que feche a súmula por expiração.
5. Encerramento automático após 2 votos só dispara via update direto em `matches` — bloqueado pela mesma RLS.

Resultado prático: a tela renderiza, mas **nenhuma ação grava**.

## NAVEGAÇÃO

- ✅ Sidebar usa `<Link to=…>` do TanStack Router; itens "Início → /minha-conta", "Atletas", "Verificar ID", "Inscrição", "Minha Conta" e os do bloco Admin navegam sem deslogar.
- ✅ Botão "Sair" desloga corretamente (`signOut` + `navigate /login`).

---

## Causas-raiz comuns (vão se repetir nos fixes)

1. **Drift de schema PT/EN** — `signup`, `inscricao`, `triagem` foram escritos com nomes em português (`nome`, `tipo`, `nome_completo`, `telefone`, `mensalidade_paga`, `grupo`, `fase_atual`, `cor_secundaria`, `time_diretor_id`) enquanto o banco está em inglês (`name`, `short_name`, `registration_type`, `status`, `lado`, `serie`, `full_name`, `phone`). Toda a triagem/inscrição precisa ser portada para o schema real.
2. **Roles e vínculo Diretor↔Time** — falta criar `user_roles(role='director')` e `team_members(role='director', accepted_at=now())` no momento da inscrição. Sem isso, `is_team_director` retorna false e tudo que depende dele falha.
3. **Súmula via client** — `matches` não tem RLS de UPDATE para diretores e os estados em PT não casam com os esperados pelas RLS. A súmula precisa virar `createServerFn` (com `requireSupabaseAuth`) que valide quem pode mover cada etapa, ou ganhar policies adequadas + enums de status alinhados.
4. **`role: 'team_manager'`** em `/admin/usuarios` deve ser `'director'` (ou o nome correto do enum).
5. Vários arquivos novos usam `// @ts-nocheck` e o cliente Supabase diretamente; isso esconde justamente os erros de schema acima.

## O que eu proponho fazer a seguir (separado, sob sua aprovação)

- **Fix A — Cadastro/Inscrição/Diretor:** refatorar `signup.tsx` para só enviar metadata válida; criar `serverFn createTeamRegistration` que insira `teams` com os campos corretos e popule `team_members` + `user_roles('director')`; ajustar `inscricao.tsx` para chamar essa fn.
- **Fix B — Admin Triagem/Usuários:** reescrever queries de `triagem.tsx` para o schema real (`status='pending'`, `lado`, `serie`, join via `manager_id → profiles(full_name,phone)`); trocar `'team_manager'` por `'director'` em `usuarios.tsx`.
- **Fix C — Súmula:** mover transições de `matches` para serverFns com checagem de papel + alinhar `status` aos valores que as RLS aceitam; corrigir inserts de `match_events`/`match_best_opponent_votes` (sem string vazia em uuid; permitir gol "sem atleta cadastrado" via coluna opcional ou jogador "placeholder").

Posso seguir com o **Fix A** primeiro (é o que desbloqueia todo o resto) assim que você aprovar.
