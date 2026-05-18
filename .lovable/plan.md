## Como você acessa a conta admin (hoje)

Hoje **ninguém é admin**. Sua conta `shelderdouglasdacruz@gmail.com` foi criada com o papel `team_manager` (padrão do trigger). O grupo "Admin" na sidebar e as rotas `/admin/dashboard`, `/admin/triagem`, `/admin/sorteio` só aparecem/funcionam quando `has_role(auth.uid(),'admin')` retorna `true`.

Solução: dois passos — bootstrap (promover sua conta agora) + tela permanente para gerenciar papéis de qualquer usuário daqui em diante.

---

## 1. Bootstrap: promover sua conta a admin

Migration única que insere a linha em `public.user_roles`:

```sql
insert into public.user_roles (user_id, role)
values ('e47e2788-9a0b-4759-a5fa-864af84c93fe', 'admin')
on conflict (user_id, role) do nothing;
```

Após aprovação, faça logout/login e o grupo "Admin" aparece na sidebar. A partir daí você acessa `/admin/dashboard`, `/admin/triagem`, `/admin/sorteio` e a nova `/admin/usuarios`.

## 2. Tela `/admin/usuarios` (gestão permanente de papéis)

Rota nova: `src/routes/_authenticated/admin/usuarios.tsx`. Acessível só por admin (componente checa `useIsAdmin` e redireciona se falso, igual às outras telas admin).

**UI:**
- Campo de busca por e-mail/nome (filtra a lista).
- Tabela listando todos os usuários: nome, e-mail, CPF (mascarado), papéis atuais (chips: Admin / Gestor de time), data de cadastro.
- Em cada linha: switch "Admin" e switch "Gestor de time". Toggle chama mutation.
- Toast de sucesso/erro.

**Server functions** (`src/lib/users.functions.ts`):
- `listUsers()` — middleware `requireSupabaseAuth` + checa se o caller é admin (`has_role`); usa `supabaseAdmin` para juntar `auth.users` (email) + `profiles` (full_name, cpf) + `user_roles`. Retorna lista DTO segura.
- `setUserRole({ user_id, role, enabled })` — middleware admin-only, valida com Zod (`role` ∈ `admin|team_manager`), faz insert ou delete em `user_roles`. Bloqueia o próprio admin de remover seu último admin role (evita lockout).

**Sidebar:** adicionar item "Usuários" (ícone `Users2` ou `Shield`) no grupo Admin, apontando para `/admin/usuarios`.

---

## Detalhes técnicos

- A migration de bootstrap NÃO altera o trigger `handle_new_user` — todo novo cadastro continua sendo `team_manager` por padrão. Admin é concedido só manualmente, pela nova tela.
- `setUserRole` usa `supabaseAdmin` (service role) porque a RLS em `user_roles` só permite ao próprio admin gerenciar — e a checagem de admin é feita no handler antes de qualquer escrita.
- Trava anti-lockout: ao desativar o switch "Admin" do próprio usuário, se ele for o único admin do sistema, a server fn retorna erro "Não é possível remover o último admin".
- Nenhuma mudança nas rotas admin existentes (dashboard/triagem/sorteio) — só passa a existir uma a mais.

## Arquivos

- **Nova migration**: promove `e47e2788-…` a admin.
- **Novo**: `src/lib/users.functions.ts` (listUsers, setUserRole).
- **Nova rota**: `src/routes/_authenticated/admin/usuarios.tsx`.
- **Editar**: `src/components/AppSidebar.tsx` (adiciona item "Usuários").

## Fora desta fase

- Convite por e-mail de novos admins.
- Logs/auditoria de mudanças de papel.
- Papéis adicionais (moderador, árbitro etc.) — quando precisar, é só adicionar ao enum `app_role`.