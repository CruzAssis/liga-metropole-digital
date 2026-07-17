## Polimento profundo — App público (rotas visitante)

Prioridade: **consistência de componentes**. Escopo: rotas públicas (`/`, `/agenda`, `/ranking`, `/ranking-craques`, `/times`, `/atletas`, `/manifesto/$slug`, `/resultados`, `/partidas/$id`, `/times/$slug`, `/atletas/$id`, `/locais`) e o shell (`PublicShell`, `PageHeader`). Identidade "Estádio Noturno" preservada — Bebas Neue/Barlow, azul #1565F5, dark. Sem tocar em auth/admin/sumula/onboarding.

### Fase 1 — Tokens e primitives (base compartilhada)

**`src/styles.css`**: sem novas cores. Adicionar tokens semânticos que hoje faltam:
- `--surface-1` / `--surface-2` / `--surface-3` (base, card, elevated)
- `--border-subtle` / `--border-strong`
- `--radius-card: 14px`, `--radius-pill: 999px`
- `--shadow-card`, `--shadow-card-hover`
- `--ring-focus` (2px `--primary` @ 50%)
- Utilities novos: `@utility surface-card`, `@utility surface-elevated`, `@utility focus-ring`, `@utility hairline` (borda de 1px consistente)
- Escala de título: `.h-display` (Bebas, clamp responsivo), `.h-section`, `.h-card`, `.eyebrow` (small caps Barlow Condensed)
- Anima: reaproveitar `animate-fade-in` já existente; adicionar `@utility card-hover` (translate-y sutil + shadow)

### Fase 2 — Kit unificado de componentes (novos wrappers)

Todos em `src/components/ui-kit/`, wrapping shadcn — não substituem, padronizam uso:

1. `SectionHeader` — eyebrow + título + subtítulo + slot de ações. Substitui variantes ad-hoc de header dentro das páginas (não confundir com `PageHeader` global, que fica).
2. `StatCard` — número grande Bebas + label Barlow Condensed uppercase + ícone opcional. Padrão único para KPIs do home/ranking/times.
3. `MetaBadge` — badge padronizado (status, série, rodada). Variants: neutral, primary, success, warn, danger.
4. `EmptyState` — já existe em `AppSkeletons`; extrair para ui-kit com CTA opcional e usar em todas as listas.
5. `DataCard` — card genérico com header/footer opcionais, hover state consistente, radius/shadow tokens.
6. `Chip` / `FilterPill` — para filtros de rodada/categoria (agenda, ranking, resultados).
7. `IconTile` — quadrado com ícone (usado em CTAs do home, feature strip).

Regra: nenhum `bg-zinc-*`/`bg-[#...]` novo. Sempre tokens.

### Fase 3 — Aplicação por rota

- **`PublicShell`**: garantir max-w consistente (`max-w-7xl`), gutters `px-4 sm:px-6 lg:px-8`, safe-area no mobile, focus outline visível na navegação.
- **`PageHeader`**: alinhar tipografia (`.h-display` + subtítulo `.text-muted-foreground`), ações wrapam consistentes.
- **`/` (index)**: hero mantém, seções abaixo migram para `SectionHeader` + `DataCard`/`StatCard`. Feature strip usa `IconTile`. CTA único destacado.
- **`/agenda`, `/resultados`**: filtros de rodada viram `FilterPill`; cards de partida com `DataCard` + `MetaBadge`. Empty state via `EmptyState`.
- **`/ranking`, `/ranking-craques`**: tabs padronizadas (`Tabs` shadcn com `MetaBadge` de série). Tabela com header sticky, zebra sutil, avatar `size-8`, badge de posição consistente.
- **`/times`**: grid responsivo `grid-cols-1 sm:2 lg:3 xl:4`, `DataCard` com escudo grande + nome (`.h-card`) + `MetaBadge` série + linha de meta (jogadores / diretores).
- **`/atletas`**: mesmo grid, `AthleteCard` refinado (avatar consistente, badge de posição, chip de time). Filtros via `FilterPill`.
- **`/manifesto/$slug`**: tipografia editorial (título display + lead), largura de leitura `max-w-prose`, spacing entre parágrafos consistente.
- **`/partidas/$id`, `/times/$slug`, `/atletas/$id`**: header com escudo/avatar grande, meta em `MetaBadge`, seções separadas por `SectionHeader`.
- **`/locais`**: cards padronizados via `DataCard` com foto + endereço + CTA.

### Fase 4 — Estados

- **Loading**: já usamos `AppSkeletons`. Verificar que toda rota pública usa skeleton estruturado (nada textual).
- **Empty**: `EmptyState` em toda lista sem dados (ranking sem temporada, times vazios, atletas sem filtro).
- **Erro**: `errorComponent` das rotas com `EmptyState` variant "danger" + botão retry (`router.invalidate()`).
- **Hover/focus**: tokens únicos aplicados via `card-hover` e `focus-ring`.

### Fase 5 — Microinterações

- `card-hover` em todos os `DataCard`
- `animate-fade-in` em listas quando dados chegam
- Toast de sonner: variant único (não misturar `toast()` e `toast.success()` com estilos diferentes)
- Transição de tab / filtro: `transition-colors` 150ms
- Sem animações pesadas.

### Fase 6 — Validação

- Typecheck + build limpos
- Playwright em 3 viewports (390/820/1440) nas 6 rotas principais, screenshots antes/depois para inspeção visual
- Auditar `rg "bg-zinc-|bg-\[#"` nas rotas alteradas: zero ocorrências novas

### Fora do escopo

- Rotas autenticadas, admin, súmula, onboarding, auth (login/signup/reset/verificar/convite)
- Mudança de paleta, fontes ou logo
- Refactor de dados, RLS, server functions
- SEO/head (já configurado)

### Ordem de execução

1. Tokens + utilities em `src/styles.css` (Fase 1)
2. Criar `src/components/ui-kit/` com 7 componentes (Fase 2)
3. Refatorar `PublicShell`/`PageHeader` (Fase 3)
4. Rotas por criticidade: index → ranking → agenda → times → atletas → manifesto → resto (Fase 3)
5. Estados + microinterações inline por rota (Fases 4/5)
6. Validação final (Fase 6)

Tempo total estimado: 1 sessão longa. Posso pausar após qualquer fase para você revisar.
