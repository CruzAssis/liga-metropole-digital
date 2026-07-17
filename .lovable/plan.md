## Escopo

Tornar 100% responsivas todas as rotas e componentes existentes, sem remover features nem mudar o design. Foco em: eliminar overflow horizontal, melhorar leitura e toque no mobile, adaptar tabelas/modais/formulários, manter consistência visual do desktop ao ultrawide.

## Fase 1 — Auditoria (só leitura)

Vou varrer o código para catalogar problemas antes de editar:

- Overflow horizontal: buscar por `w-[<valor px>]`, `min-w-[<valor px>]`, `whitespace-nowrap`, tabelas sem wrapper com scroll, `overflow-x-*` mal usado.
- Widths fixos: `w-[NNNpx]`, `min-w-[NNNpx]`, `max-w-[NNNpx]` sem contrapartida responsiva.
- Headers/rows quebrando: `flex flex-wrap` com texto + widgets (padrão errado documentado no projeto — deve virar grid `grid-cols-[minmax(0,1fr)_auto] sm:flex`).
- Tabelas: componentes `<Table>` usados sem wrapper `overflow-x-auto` no mobile — decidir entre scroll horizontal em wrapper ou virar cards no mobile.
- Modais/Dialogs: verificar `Dialog` que não usa `max-h-[90vh]` + `overflow-y-auto`, e formulários dentro deles.
- Tipografia: `text-4xl`+ sem escala `text-2xl sm:text-3xl md:text-4xl`.
- Sidebar admin: comportamento em mobile (`AppSidebar` já é shadcn `collapsible="icon"` — validar trigger visível no header).
- Imagens: `<img>` sem `max-width:100%` (Tailwind classes ausentes).
- Botões `size="icon"` como alvo principal de toque (< 44px).

Rotas para revisar em ordem de tráfego/impacto:
1. Públicas de alto tráfego: `index`, `ranking`, `ranking-craques`, `resultados`, `atletas`, `atletas.$id`, `times`, `times.$slug`, `agenda`, `partidas.$id`, `sumula-visual.$partidaId`.
2. Onboarding/auth: `login`, `signup`, `forgot-password`, `reset-password`, `onboarding.*`, `convite.$code`.
3. Autenticadas do usuário: `minha-conta`, `minha-conta/excluir-conta`, `elenco`, `inscricao`.
4. Admin: `admin/dashboard`, `admin/times`, `admin/sumulas`, `admin/usuarios`, `admin/triagem`, `admin/notificacoes`, `admin/financeiro`, `admin/ligas`, `admin/sorteio`, `admin/master-switch`, `admin/manifesto`.
5. Institucionais: `manifesto.$slug`, `termos`, `privacidade`, `locais`, `verificar`, `sumula-exemplo`.

Componentes para revisar:
- `AppShell`, `AppSidebar`, `PublicShell`, `PageHeader` (base do layout — impacto em todas as rotas).
- `athletes/*`, `matches/*`, `teams/*`, `home/*`, `DestaqueShareCard`, `WelcomeAthleteModal`, `ManifestoContent`.

Entregável da auditoria: lista concreta de arquivos + problemas encontrados (sem código ainda), agrupada por categoria.

## Fase 2 — Correções (por categoria, não por arquivo)

Aplicar padrões consistentes usando os utilitários que o projeto já usa (Tailwind v4 + shadcn):

### 2.1 Shell e navegação
- Garantir que o layout base (`AppShell`/`PublicShell`) tenha `min-h-screen w-full overflow-x-hidden` no wrapper e paddings responsivos (`px-4 sm:px-6 lg:px-8`).
- Header com `SidebarTrigger` sempre visível no mobile (área ≥ 44×44).
- Menus/dropdowns em Radix (shadcn) já são responsivos; só ajustar largura máx e `max-h-[80vh] overflow-y-auto` onde faltar.

### 2.2 Headers de página
Padronizar linhas título + ações com o padrão documentado do projeto:

```tsx
<header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between">
  <div className="flex min-w-0 items-center gap-3">
    <Avatar className="shrink-0" />
    <h1 className="truncate text-xl font-bold sm:text-2xl md:text-3xl">…</h1>
  </div>
  <Actions />
</header>
```

### 2.3 Grids de cartões (times, atletas, ranking, agenda, resultados)
- Padrão: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6`.
- Cartão em si com `min-w-0` e texto com `truncate` ou `line-clamp-2`.

### 2.4 Tabelas (admin/triagem, admin/times, admin/sumulas, admin/usuarios, admin/financeiro, ranking, resultados)
Duas abordagens dependendo da densidade:
- Densidade baixa/média: envolver em `<div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">` para permitir scroll horizontal no mobile sem quebrar o layout ao redor.
- Densidade alta com muitas colunas: manter tabela em `md:` e renderizar variação em cards no mobile (`md:hidden` cards + `hidden md:block` tabela). Aplicar só onde a tabela hoje sofre — não em todas.

### 2.5 Modais/Dialogs (SumulaDialog, ConfirmSumulaDialog, WelcomeAthleteModal, dialogs internos de admin)
- `DialogContent` com `max-h-[90dvh] overflow-y-auto w-[min(100%,32rem)] sm:max-w-lg` (ajustar tamanho por caso).
- Formulários internos: `grid grid-cols-1 sm:grid-cols-2 gap-4` quando fizer sentido; caso contrário empilhados.
- Botões de ação em `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`.

### 2.6 Formulários (login, signup, onboarding.*, inscricao, admin/*)
- Inputs full-width no mobile (padrão shadcn já cobre; validar containers pai).
- Botões primários `w-full sm:w-auto` em fluxos de submissão longos.
- Espaçamento vertical `space-y-4 sm:space-y-6`.

### 2.7 Tipografia
- Escala de títulos: `text-2xl sm:text-3xl md:text-4xl` para h1 de página; `text-lg sm:text-xl` para h2 de seção.
- Números grandes de destaque (ranking, home stats): `text-3xl sm:text-4xl md:text-5xl` com `tabular-nums`.
- Quebra segura: adicionar `break-words` em nomes/labels que possam ser longos; `truncate` só quando houver tooltip/expandir alternativo.

### 2.8 Imagens e mídia
- `<img>` sempre com `className="w-full h-auto"` ou dentro de `aspect-*` com `size-full object-cover`.
- HeroCarousel: garantir alturas fluidas por breakpoint em vez de fixas.
- DestaqueShareCard e MatchdayFlyer (renderizados para compartilhar): manter dimensões fixas de exportação, mas envolver no preview com `overflow-auto` no mobile.

### 2.9 Contêineres e overflow
- `main` global com `overflow-x-hidden` para segurar bugs de estouro; nunca o oposto (`overflow-x-auto`) no `body`.
- Substituir `w-[NNNpx]` por `w-full max-w-[NNNpx]` onde encontrado.

### 2.10 Alvos de toque
- Botões `size="icon"` que são o alvo principal (fechar dialog, abrir menu): promover para `min-h-11 min-w-11`.
- Espaçar chips/links adjacentes com `gap-2` mínimo.

## Fase 3 — Validação

- Build da app + typecheck (automático do harness).
- Playwright headless: abrir preview local em 3 viewports (`390×844` mobile, `820×1180` tablet, `1440×900` desktop) e rodar por 5–6 rotas críticas (`/`, `/ranking`, `/times`, `/agenda`, `/minha-conta` autenticado, `/admin/times` como admin se possível). Screenshot de cada uma.
- Checar: sem scroll horizontal (`document.documentElement.scrollWidth === clientWidth`), header sem sobreposição, tabelas navegáveis, modais críticos abrem sem cortar botões.

## Detalhes técnicos

- Stack: Tailwind v4 (via `@import "tailwindcss"` em `src/styles.css`, tokens em `@theme`), shadcn/ui, TanStack Router com file-based routing em `src/routes/`.
- Breakpoints usados: os defaults do Tailwind (`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`). Não vou introduzir breakpoints custom para manter consistência.
- `dvh`/`svh` para alturas de tela cheia (barra do Safari mobile) onde relevante.
- Nada de `@media` manual em CSS quando o utilitário Tailwind resolve.

## Regras que vou seguir

- Não altero lógica de negócio, RLS, server functions, nem tipos.
- Não removo componentes/páginas.
- Não introduzo libs novas.
- Mudanças em lote por categoria de problema para manter o diff coerente.
- Cada edit mantém o design base — mesmas cores, mesmos tokens, mesmos ícones.

## Fora do escopo

- Acessibilidade profunda (ARIA, foco de teclado além do que shadcn já entrega): mencionarei se encontrar problemas críticos, mas não é o pedido.
- Otimização de performance (bundle, imagens): idem.
- Reescrever tabelas complexas de admin como grids de cards (só faço quando a tabela realmente estoura no mobile e não há solução via scroll).

## Sequência de entrega

1. Rodar auditoria concreta e devolver a lista de arquivos afetados agrupada por categoria (5–10 min de leitura).
2. Aplicar correções em ordem: shell/nav → headers → grids → tabelas → dialogs → formulários → tipografia/imagens.
3. Rodar Playwright multi-viewport nas rotas críticas e anexar screenshots.
4. Fechar com um resumo do que mudou e o que ficou fora.
