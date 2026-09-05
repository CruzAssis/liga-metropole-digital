-- ============================================================================
-- Acrescenta os valores de enum que o codigo ja usa e o banco nao conhece.
--
-- src/lib/mvp-notify.server.ts grava notificacao com tipo='mvp_definido' e
-- canal='app'. Nenhum dos dois existe:
--   notificacao_tipo  = team_approved, jogo_agendado, sumula_disponivel,
--                       sumula_prazo_alerta, destaque_publicado
--   notificacao_canal = email, whatsapp
--
-- Nao e so erro de tipagem. Sao ENUMs de verdade, entao o SELECT da linha 119
-- ja estoura com "invalid input value for enum" antes mesmo de chegar no
-- INSERT. Ou seja: closeExpiredVotingAndNotify() falha por inteiro toda vez
-- que roda, e com ela o cron /api/public/hooks/close-voting. A votacao de
-- craque nunca fecha e ninguem e notificado.
--
-- Isso e anterior a auditoria de 04/09 — `tsc --noEmit` reprovava na main
-- com estes mesmos dois erros.
--
-- ALTER TYPE ... ADD VALUE roda em transacao no Postgres 12+ desde que o
-- valor novo nao seja usado na mesma transacao. Aqui so acrescentamos.
-- ============================================================================

ALTER TYPE public.notificacao_tipo  ADD VALUE IF NOT EXISTS 'mvp_definido';
ALTER TYPE public.notificacao_canal ADD VALUE IF NOT EXISTS 'app';
