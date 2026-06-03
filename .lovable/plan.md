## Plano de execução

### Fix 1 — Ranking conta súmulas fechadas (rápido)
- `src/routes/ranking.tsx`: trocar filtro `FINISHED = ["confirmed", "wo"]` para `["confirmed", "closed", "wo"]`.
- Resultado: assim que os dois diretores avaliam o destaque, a partida vira `closed` e já entra na classificação.

### Fix 2 — Sorteio gera calendário automático (data, hora, local)

**UI Admin (`/admin/sorteio`):**
- Adicionar 2 campos antes do botão "Executar sorteio":
  - Data da primeira rodada (date picker)
  - Intervalo entre rodadas (default: 7 dias)

**Server fn `executeDraw` (`src/lib/draw.functions.ts`):**
- Aceitar `firstRoundDate: string` e `intervalDays: number` no input.
- Buscar `home_time` e `home_venue` de todos os mandantes aprovados (já existe no schema `teams`).
- Para cada partida criada, preencher:
  - `scheduled_at` = `firstRoundDate + (round - 1) * intervalDays`, combinado com o `home_time` do mandante. Se o mandante não tiver `home_time`, default 15:00.
  - `venue` = `home_venue` do mandante (pode ficar null se o mandante não cadastrou).
- Todos os jogos da rodada 1 caem no mesmo dia, cada um no horário do seu mandante.

**Validação na inscrição:**
- Tornar `home_time` obrigatório para times tipo `host` (já parece ser, confirmar) e exigir também `home_venue` antes da aprovação na triagem.

### Fix 3 — WO automático após 72h (cron job)

**Server route pública** (`src/routes/api/public/hooks/wo-checker.ts`):
- Verifica header `apikey` (anon key).
- Busca partidas com `status IN ('scheduled','awaiting_confirmation')` cujo `scheduled_at + 72h < now()`.
- Aplica regra de WO:
  - Se `status = 'scheduled'` e ninguém lançou placar → WO duplo (3×0 a favor do mandante por padrão, ou marcar como `wo` sem placar — a definir).
  - Se `status = 'awaiting_confirmation'` há +72h → confirmar o placar lançado automaticamente (entende-se que o mandante não contestou).
- Atualizar status para `wo` ou `confirmed` conforme caso.

**Cron job (`pg_cron`):**
- Job diário às 03:00 chamando o endpoint acima via `pg_net.http_post`.

**UI da súmula (`/partidas/$id`):**
- Adicionar badge de countdown "Faltam Xh para WO automático" quando a partida estiver pendente.

### Detalhes técnicos

- **Migração necessária**: nenhuma alteração de schema. Os campos `scheduled_at`, `venue`, `home_time`, `home_venue` já existem.
- **Status `wo`**: o ranking já reconhece, mas precisa de uma convenção: como representar placar de WO? Sugestão: `host_score=3, visitor_score=0, status='wo'` (e inverter quando o WO for do mandante).
- **Permissões**: o cron usa `supabaseAdmin` (service role) — não passa por RLS.
- **Reset do sorteio**: hoje `executeDraw` bloqueia se `draw_executed_at != null`. Manter, mas adicionar server fn `resetDraw` (admin) para apagar matches e zerar `draw_executed_at` caso precise refazer.

### Ordem de execução
1. Fix 1 (ranking) — 1 linha
2. Fix 2 (calendário + local no sorteio) — `draw.functions.ts` + UI `/admin/sorteio`
3. Fix 3 (WO 72h) — server route + cron + badge countdown

Após implementar, o fluxo completo fica: cadastro → triagem aprova nos 4 lotes → admin executa sorteio com data inicial → 800 jogos com data/hora/local → diretores preenchem súmula → ranking atualiza automaticamente → cron aplica WO em pendências de 72h.
