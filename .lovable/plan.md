## Visão geral

Três frentes integradas:
1. **Cadastro do diretor** com WhatsApp + e-mail (já temos os dois — falta exibir e tornar editável).
2. **Notificações** por e-mail automático (Lovable Cloud) + botões wa.me prontos para o diretor disparar.
3. **Perfil público do clube** em `/times/:slug` com contatos, elenco, jogos e classificação.

---

## 1. Cadastro do diretor (WhatsApp + e-mail)

Hoje já coletamos `full_name`, `cpf`, `phone`, `email` no signup. Vamos:

- Renomear visualmente "Telefone" para **"WhatsApp"** em `/signup` e validar formato BR (10–11 dígitos, DDD).
- Adicionar bloco **"Dados do diretor/técnico"** em `/minha-conta` com edição inline de WhatsApp e e-mail (e-mail muda via `supabase.auth.updateUser`, WhatsApp via `profiles`).
- Garantir que `profiles.phone` nunca fica nulo para gestores aprovados (validação no formulário de inscrição).

## 2. Notificações de partida

Para cada jogo, três momentos:

| Momento | Canal | Conteúdo |
|---|---|---|
| **Jogo agendado** (sorteio ou reagendamento) | E-mail aos dois diretores | Data, local, adversário, link `wa.me` do adversário com mensagem pré-pronta ("Olá, sou o diretor do {time}, vamos jogar dia X…") |
| **24h antes do jogo** | E-mail aos dois diretores | Lembrete + botão "Falar com adversário no WhatsApp" |
| **Pós-jogo (status `scheduled` → expirou sem placar)** | E-mail ao mandante | "Lance o placar da súmula" + link direto para `/minha-conta` |
| **Placar lançado, aguardando confirmação** | E-mail ao visitante | "Confirme o placar X–Y em até 48h" + link |

**Implementação:**
- Habilitar infra de e-mail (Lovable Cloud — domínio padrão, sem custo).
- Tabela `notification_log` (match_id, recipient_user_id, kind, sent_at) para evitar duplicatas.
- `pg_cron` a cada 15min chamando `/api/public/hooks/match-notifications` que:
  - busca jogos `scheduled` cuja `scheduled_at` está entre 23h–25h no futuro → envia lembrete 24h
  - busca jogos `scheduled` cuja `scheduled_at` passou há > tolerância → envia "lance o placar"
  - busca jogos `awaiting_confirmation` há > 24h → reenvia ao visitante
- Disparos imediatos (jogo agendado, placar lançado) via server function chamada nos handlers existentes (sorteio, súmula).
- Cada e-mail inclui botão **"Abrir WhatsApp do adversário"** = `https://wa.me/55{phone}?text={mensagem URL-encoded}`.

## 3. Perfil público do clube

Rota nova `src/routes/times.$slug.tsx` (slug derivado de `short_name`, ex.: `/times/santos-fc`).

**Layout (mobile-first, single column):**

```text
┌─────────────────────────────┐
│  [Escudo grande]            │
│  Nome do Time     [✓ Verif] │
│  Sigla · Mandante           │
├─────────────────────────────┤
│  Contato                    │
│  Diretor: João Silva        │
│  [WhatsApp] [E-mail]        │  ← botões; só logado vê os dados
├─────────────────────────────┤
│  Elenco (12 atletas)        │
│  grid de AthleteCard        │
├─────────────────────────────┤
│  Próximos jogos             │
│  lista de 3 cards           │
├─────────────────────────────┤
│  Resultados                 │
│  últimos 5                  │
├─────────────────────────────┤
│  Classificação              │
│  posição na tabela do grupo │
└─────────────────────────────┘
```

- Página renderiza para qualquer visitante (status='approved' já é público via RLS).
- WhatsApp/e-mail do diretor: **escondidos para anônimos**, visíveis para qualquer logado (anti-scraping). Server fn `getTeamContact(slug)` exige `requireSupabaseAuth`.
- Adicionar link "Ver perfil público" em `/times` (lista) e em `/minha-conta`.

---

## Detalhes técnicos

**Migration**:
- `ALTER TABLE teams ADD COLUMN slug text UNIQUE` + backfill (`lower(regexp_replace(short_name, '[^a-z0-9]', '-', 'gi'))`).
- `CREATE TABLE notification_log (id, match_id, user_id, kind, sent_at)`.
- Habilitar `pg_cron` + `pg_net`, agendar job a cada 15min.

**Server functions** (novos arquivos):
- `src/lib/notifications.functions.ts` — `sendMatchScheduledEmail`, `sendScoreRequestEmail`, `sendConfirmRequestEmail`.
- `src/lib/team-profile.functions.ts` — `getTeamPublicProfile(slug)`, `getTeamContact(slug)` (auth).
- `src/lib/wa.ts` — helper puro `buildWhatsAppLink(phone, message)`.

**E-mail**:
- Infra Lovable Cloud (sem custo até 3k/mês, domínio compartilhado).
- Template simples: header com escudo da liga, corpo com info do jogo, botão WhatsApp, botão "Abrir liga".

**Edição em `/signup` e `/minha-conta`**:
- Validação WhatsApp: `z.string().regex(/^\d{10,11}$/)` (só dígitos, DDD obrigatório).
- Exibição formatada: `(11) 98765-4321`.

---

## Fora desta fase

- Envio real via WhatsApp Business API (continua sendo só link `wa.me`).
- Estatísticas individuais por atleta (gols, cartões).
- Histórico de confrontos diretos no perfil.
- Customização de avatar/banner do clube no perfil público.

---

## Arquivos afetados

**Novos:**
- `src/routes/times.$slug.tsx` — perfil público
- `src/routes/api/public/hooks/match-notifications.ts` — cron handler
- `src/lib/notifications.functions.ts`
- `src/lib/team-profile.functions.ts`
- `src/lib/wa.ts`
- 1 migration (slug + notification_log + cron)

**Editados:**
- `src/routes/signup.tsx` — label "WhatsApp"
- `src/routes/_authenticated/minha-conta.tsx` — bloco contato editável + link "perfil público"
- `src/routes/times.tsx` — cards linkam para `/times/:slug`
- `src/lib/sumula.functions.ts` — dispara e-mail no lançamento de placar
- `src/lib/draw.functions.ts` — dispara e-mail no sorteio
