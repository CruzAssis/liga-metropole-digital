# Liga Metrópole Digital

App de gestão de liga e campeonato amador de futebol society.

O usuário primário é o **organizador** da liga — não o jogador, não o
torcedor. Recurso que não facilita a vida de quem administra o campeonato não
é prioridade.

- Produção: https://liga-metropole-digital.vercel.app
- Banco: Supabase
- Deploy: push na `main` publica automaticamente. Não há staging.

## Rodando localmente

Requer [Bun](https://bun.sh) (o projeto usa `bun.lock`, `bun test` e
`bunfig.toml`; não há `package-lock.json`).

```bash
bun install
cp .env.example .env      # preencha os valores
bun dev                   # http://localhost:5173
```

Sem `.env` preenchido a aplicação sobe, mas toda server function que fala com
o Supabase falha com "Missing Supabase environment variable(s)".

### Variáveis de ambiente

Estão descritas em [`.env.example`](.env.example). Resumo do que é o quê:

| Variável | Onde vive | Observação |
|---|---|---|
| `VITE_SUPABASE_*` | navegador | Públicas por design, viajam no bundle. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | servidor | Usadas pelo middleware de auth. |
| `SUPABASE_SERVICE_ROLE_KEY` | servidor | **Bypassa RLS.** Nunca commitar, nunca prefixar com `VITE_`. |
| `CRON_SECRET` | servidor | Protege `/api/public/hooks/*`. |
| `IP_HASH_SALT` | servidor | Rate limit da consulta por CPF em `/verificar`. |

Sem `IP_HASH_SALT` a rota `/verificar` responde **503 de propósito** — ela
falha fechada em vez de servir dado pessoal sem proteção.

## Scripts

```bash
bun dev                  # desenvolvimento
bun run build            # build de produção
bun run lint             # eslint
bunx tsc --noEmit        # typecheck
bun test                 # todos os testes
bun run test:standings   # classificação (puro, não precisa de banco)
bun run test:rls         # RLS/PII (precisa de Supabase local)
```

Os testes de RLS, convite, onboarding e inscrição sobem um Supabase local
(`supabase start`) e leem `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` e
`SUPABASE_SERVICE_ROLE_KEY` do ambiente. O de classificação é puro e roda
em qualquer lugar.

## Migrations

Ficam em `supabase/migrations/`, aplicadas em ordem de nome.

**Migrations que apagam ou anonimizam dado não são aplicadas
automaticamente.** São rodadas à mão no SQL Editor do Supabase por quem
administra a liga.

## Formato da competição

O desenho que o código implementa, e que o sorteio (`src/lib/draw.functions.ts`)
gera:

- Times se inscrevem como **Mandante** (`registration_type = 'host'`, tem
  campo) ou **Visitante** (`'visitor'`, não tem).
- Confrontos são **sempre Mandante × Visitante**, e só dentro do mesmo
  **Lado** (`teams.lado`, A ou B).
- Com *n* mandantes e *n* visitantes num lado: *n* rodadas, *n²* partidas.
  Cada mandante recebe todos os visitantes uma vez — daí "10 jogos em casa"
  e "10 jogos fora".
- Cada categoria tem **tabela própria e campeão próprio**. A classificação
  sai agrupada por lado.
- Mandantes e visitantes precisam estar em **número igual** dentro do lado,
  senão os times jogariam quantidades diferentes de partidas e a tabela
  compararia coisas diferentes.

## Súmula

Quem preenche o placar é o diretor do time **visitante**; quem homologa é o
do **mandante**. Passadas 72h sem isso, aplica-se WO de 3×0 para o mandante
— pelo cron (`/api/public/hooks/wo-checker`) ou pela tela da súmula.

## Segurança

O repositório é **público**. Vale para todo commit:

- Nenhuma credencial, chave, token ou `.env`.
- Nenhuma nota interna, dado de cliente ou comentário de trabalho.
- Qualquer pessoa lê o código inteiro, inclusive o que está com `display:none`.

Ao mexer em rota pública, conferir autenticação e rate limit antes de
qualquer outra coisa.

CI em `.github/workflows/`:

- `ci.yml` — typecheck, lint, teste da classificação e build, em todo push.
- `security.yml` — sobe Supabase local, roda o linter do banco, as asserções
  de RLS/PII (`scripts/security-assert.sql`) e os testes de RLS.
