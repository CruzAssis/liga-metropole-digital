## Visão geral

Estrutura inicial do SaaS "Liga Metrópole Várzea" com Lovable Cloud (Supabase gerenciado), autenticação email/senha, cadastro de times com upload de escudo, controle de vagas (40 por tipo) e painel do gestor.

## 1. Lovable Cloud + Banco de dados

Habilitar Lovable Cloud e criar via migração:

- **Tabela `profiles`** — vinculada a `auth.users`, com `full_name`, `phone`, `cpf` (único), `avatar_url`. O campo `role` será movido para tabela separada por segurança (ver abaixo).
- **Enum `app_role`** + tabela **`user_roles`** (`user_id`, `role`) com função `has_role(_user_id, _role)` SECURITY DEFINER — padrão obrigatório para evitar escalonamento de privilégios. Default ao cadastrar: `team_manager`.
- **Tabela `teams`** conforme spec (name, short_name, logo_url, manager_id, registration_type, status, rejected_reason, approved_at) + índices em `status` e `registration_type`.
- **Trigger** `handle_new_user` em `auth.users` → cria `profiles` automaticamente lendo `full_name`, `phone`, `cpf` dos metadados do signup, e insere `team_manager` em `user_roles`.
- **Bucket Storage** `team-logos` (público) com policies para o gestor enviar/atualizar seu escudo.

### RLS

- `profiles`: SELECT/UPDATE apenas onde `id = auth.uid()`.
- `user_roles`: SELECT do próprio usuário; INSERT/UPDATE somente admin (via `has_role`).
- `teams`: 
  - SELECT público quando `status = 'approved'`
  - SELECT/UPDATE pelo gestor (`manager_id = auth.uid()`)
  - INSERT autenticado com `manager_id = auth.uid()`
  - Admins têm acesso total via `has_role(auth.uid(), 'admin')`

## 2. Identidade visual

- Configurar `src/styles.css` com tokens semânticos em **oklch**: `--background` (#1A1A1A), `--card` (#242424), `--primary` (#007BFF), foreground branco, bordas sutis. Definir variantes `.dark` (default ativo no `<html>`).
- Importar **Bebas Neue** e **Montserrat** via `<link>` no `__root.tsx` head.
- Classes utilitárias `font-display` (Bebas) e `font-sans` (Montserrat) no Tailwind theme.
- Tema dark forçado por padrão.

## 3. Layout

- **`AppShell`** (componente): sidebar fixa à esquerda + header superior + `<Outlet />`.
- Sidebar usando shadcn `Sidebar` com itens: Início, Inscrição, Minha Conta, Sair (collapse para ícones).
- Header com logo "Liga Metrópole Várzea", `SidebarTrigger`, avatar/menu do usuário.
- Landing (`/`) renderiza fora do shell (página pública full-bleed). `/login` e `/signup` também fora do shell.

## 4. Rotas (TanStack Router file-based)

```
src/routes/
  __root.tsx              (fonts, providers, auth listener)
  index.tsx               (landing)
  login.tsx
  signup.tsx
  _authenticated.tsx      (guard: redirect /login se sem sessão)
  _authenticated/inscricao.tsx
  _authenticated/minha-conta.tsx
```

### Páginas

- **`/` Landing**: hero com "Metrópole Várzea" em Bebas Neue gigante, subtítulo, CTA primário "Inscrever meu time" → `/signup` (ou `/inscricao` se logado). Fundo dark com destaque azul.
- **`/signup`**: form (nome completo, CPF, telefone, email, senha) → `supabase.auth.signUp` com `options.data` para o trigger criar o profile. `emailRedirectTo: window.location.origin`.
- **`/login`**: email + senha. Após login → `/minha-conta`.
- **`/inscricao`**: form com Nome do time, Sigla (3-4 letras maiúsculas), upload do escudo (preview + upload para `team-logos/{user_id}/{filename}`), tipo (radio Mandante/Visitante). Validação Zod. Lógica de submit:
  1. Conta `teams` aprovados do mesmo `registration_type`.
  2. Se ≥ 40 → insere com `status='waitlist'` e exibe toast "Vagas de [tipo] esgotadas — você entrou na sala de espera".
  3. Caso contrário → `status='pending'`, mensagem "Time enviado para análise".
  4. Bloqueia se o gestor já tem time cadastrado.
- **`/minha-conta`**: lê o time do gestor, exibe card com escudo, nome, sigla, tipo e badge de status colorido (Em análise / Aprovado / Rejeitado / Sala de espera). Se rejeitado, mostra `rejected_reason`. Botão "Editar" se `pending`/`waitlist`.

## 5. Auth

- Listener `onAuthStateChange` no `__root.tsx` invalidando router + react-query.
- Guard `_authenticated.tsx` com `beforeLoad` checando `supabase.auth.getUser()`.
- Hook `useCurrentUser()` em `src/hooks/`.

## 6. Validação e segurança

- Zod schemas para todos os forms (CPF 11 dígitos, telefone, sigla regex `^[A-Z]{3,4}$`, tamanho do upload ≤ 2MB, mime `image/*`).
- Contagem de vagas feita server-side via `createServerFn` com `requireSupabaseAuth` para evitar race conditions no cliente; alternativa simples nesta primeira versão: contagem + insert no client com RLS (aceitável MVP — anotar para reforçar depois com unique partial index ou função RPC).

## Detalhes técnicos

- **Stack**: TanStack Start + React 19 + Tailwind v4 + shadcn/ui + Lovable Cloud.
- **Roles**: nunca em `profiles` — sempre em `user_roles` + `has_role()` SECURITY DEFINER (padrão Lovable obrigatório).
- **Storage**: bucket `team-logos` público; path `{auth.uid()}/{timestamp}-{filename}`; policy de INSERT/UPDATE/DELETE restrita ao próprio uid via `(storage.foldername(name))[1] = auth.uid()::text`.
- **Trigger profile**: lê `new.raw_user_meta_data->>'full_name'`, `'phone'`, `'cpf'`. Signup deve passar esses campos em `options.data`.
- **Tema**: `<html class="dark">` fixo (sem toggle nesta etapa).
- **Não incluído nesta etapa**: painel admin de aprovação, gestão de atletas, partidas, pagamentos — escopo de iterações futuras.

## Próximas iterações sugeridas

- Painel admin (`/admin`) para aprovar/rejeitar times.
- Função RPC com lock para garantir o limite de 40 sem race condition.
- Email transacional ao mudar status do time.
