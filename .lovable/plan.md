# Auditoria: App Atual vs. Master Blueprint V3

Análise feita lendo o schema do Supabase, as rotas (`src/routes/**`), os server functions (`src/lib/*.functions.ts`) e o estado de dados (`teams` está praticamente vazio, só com `team_manager` / `admin` / `athlete` no enum de roles).

---

## [OK] — Já existe e respeita o Blueprint V3

- **Autenticação base**: signup/login/reset, perfis com `full_name`, `phone`, `cpf` obrigatórios, trigger `handle_new_user`, RLS via `has_role()` + tabela `user_roles` separada (padrão seguro).
- **Cadastro de time (Diretor)**: fluxo de inscrição, status `pending/approved/rejected/waitlist`, fila de espera com `promote_waitlist_for_type`, triagem admin.
- **Elenco e atletas**: CRUD de atletas vinculados ao time, foto, posição, verificação por CPF (hash + last4), selo "verificado".
- **Súmula**: fluxo Mandante preenche → Visitante confirma, com `host_filled_at` / `visitor_confirmed_at`, eventos em `match_events`, janela de confirmação configurável (`sumula_confirm_window_hours`).
- **Melhor em campo do adversário**: tabela `match_best_opponent_votes` já modelada com identificação posterior.
- **Mando de campo (Diretor)**: `teams.home_venue` e `teams.home_time` + painel + fallback no Matchday Flyer.
- **Páginas públicas básicas**: home, agenda, resultados, ranking, atletas, locais, perfil de time (`/times/$slug`), página de partida (`/partidas/$id`) com share link.
- **Admin**: dashboard, triagem, sorteio (fase de grupos M/V × A–H, 5+5 rodadas), súmulas, usuários.
- **Matchday Flyer**: geração PNG client-side (`html2canvas`).
- **Logo institucional** padronizado via `BrandLogo`.

---

## [AJUSTAR] — Existe mas precisa mudar para V3

1. **Estrutura de competição (1 → 3 séries)**
   - Hoje `competitions` é genérica e `registration_type` no time é só `host` / `visitor`. V3 exige **Série A, Série B, Série C** (cada uma com sub-divisão M/V em A e B, e formato livre em C).
   - Ajustar: adicionar `division` (`A|B|C`) em `teams` e `competitions`, e em `groups`; o `team_role` (`host|visitor`) só se aplica a A e B.

2. **Sorteio / fase de grupos** (`src/lib/draw.functions.ts`)
   - Hoje gera 16 grupos fixos (A–H × host/visitor) com 5 times cada — ou seja, foi desenhado para **uma divisão** (80 times). Precisa ser parametrizado **por divisão** (rodar 3 vezes: A, B, C) e a Série C precisa de regra própria: **livre, máx. 2 jogos contra o mesmo adversário, máx. 3 pontos/semana**.

3. **Perfis de usuário**
   - Hoje só existe `team_manager` (Diretor) + `admin` + `athlete` (no enum mas sem fluxo). V3 exige **3 perfis autenticados distintos: Diretor, Jogador, Torcedor**, todos com Nome/Email/CPF/Telefone. Ajustar enum + fluxos de signup que escolhem o perfil + vínculos:
     - Diretor → **1 time** (já é assim).
     - Jogador → **N times** (precisa tabela de vínculo N:N e fluxo "aceitar indicação do diretor").
     - Torcedor → **1 time** (precisa tabela `team_supporters`).

4. **Súmula com indicação opcional**
   - Hoje a súmula usa `athletes` cadastrados. V3 permite o Diretor indicar atleta **só com nome + idade + posição + foto opcional**, sem CPF. Ajustar: tornar `cpf_hash`/`cpf_last4` nullable OU criar tabela `match_lineup_guests` para escalações ad-hoc por partida.

5. **Página pública / Dashboard**
   - Hoje há `ranking`, `resultados`, `agenda` genéricos. V3 exige **3 tabelas separadas (A/B/C)**, **Artilharia Monoclub** (gols agrupados por time, isolando o maior artilheiro de cada) e **Torcedômetro**. Vai virar refatoração da home + novas seções.

6. **Mata-mata** (já discutimos: não existe lógica)
   - `matches.stage='knockout'`, `bracket_position`, `parent_match_id` existem mas **nenhum código lê/escreve**. Precisa virar implementação real seguindo V3 (ver abaixo).

---

## [CRIAR DO ZERO] — Ausente, precisa programar

1. **Sistema de Acesso/Degola entre semestres**
   - Job/tela admin que, ao encerrar a temporada, rebaixa os 4 últimos de A→B e B→C, sobe os 4 primeiros de B→A e C→B, e cria o **Play-In** (jogo único): 5º e 6º da divisão inferior **na casa** do 15º e 16º da divisão superior.

2. **Mata-mata com chaves separadas Mandantes × Visitantes**
   - Gerador de chaveamento por divisão e por papel (host bracket / visitor bracket), avanço automático do vencedor para `parent_match_id`, final da categoria na casa da melhor campanha, **Grande Finalíssima Geral em campo neutro** (campo `is_neutral_venue` + `venue` definido pelo admin).
   - Tela pública de bracket + tela admin de avanço/W.O.

3. **Final Anual: Campeão do 1º Semestre × Campeão do 2º Semestre**
   - Modelo `seasons` (ano), `competition.season_half` (1|2), e uma "Super Final" anual cruzando os dois campeões.

4. **Série C — regras próprias**
   - Engine de agendamento que respeita: **máx. 2 jogos contra o mesmo adversário** e **máx. 3 pontos/semana por time** (cap de pontos contabilizados). Ranking absoluto por pontos.

5. **Perfil Jogador (multi-time)**
   - Signup com escolha de perfil; tabela `athlete_team_links` (athlete_user_id, team_id, status `invited|accepted|rejected`); fluxo "Diretor indica → Jogador aceita" (notificação + tela "Meus convites").
   - Vinculação automática quando CPF do jogador bate com `athletes.cpf_hash`.

6. **Perfil Torcedor + Torcedômetro**
   - Tabela `team_supporters (user_id, team_id, created_at)` com unique em `user_id`; agregação pública (contagem por time, evolução semanal) e widget na home.

7. **Artilharia Monoclub**
   - View/server fn que pega o maior artilheiro de cada time e os ranqueia entre si (artilharia "monoclube" = um jogador por clube).

8. **Auditoria de Arbitragem**
   - Tabela `referee_ratings (match_id, visitor_team_id, rating 1-10, created_at)`; após súmula, visitante avalia o juiz do mandante; gatilho que detecta **3 notas consecutivas < 5 para o mesmo time mandante** → cria registro em `referee_audit_alerts` e notifica admin; tela admin de auditoria.

9. **Notificações in-app**
   - `notification_log` existe mas só registra envio; falta UI de inbox e os disparos para: convite de jogador, alerta de auditoria, súmula pendente, play-in agendado, etc.

10. **Calendário com travas anti-conflito**
    - Validação no agendamento para não violar "3 pts/semana" (Série C) e para respeitar mando/horário padrão do clube mandante.

---

## Ordem sugerida de implementação (próximos passos)

1. Refatorar `competitions`/`teams` para **divisão A/B/C** + `season` + `season_half` (migration grande, base de tudo).
2. Parametrizar o sorteio por divisão e implementar engine da Série C.
3. Introduzir os perfis **Jogador** e **Torcedor** (enum + signup + vínculos N:N e 1:1).
4. Mata-mata (chaves separadas, finais, finalíssima neutra) + Play-In + Super Final anual.
5. Dashboard pública nova (3 tabelas + Artilharia Monoclub + Torcedômetro).
6. Auditoria de Arbitragem.
7. Polimento de notificações e travas de calendário.

Confirma se quer que eu já gere o plano de implementação detalhado do passo 1 (refatoração para 3 divisões + temporadas) para começarmos?
