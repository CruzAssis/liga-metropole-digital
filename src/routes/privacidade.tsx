import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/PublicShell";

export const Route = createFileRoute("/privacidade")({
  component: PrivacidadePage,
  head: () => ({
    meta: [
      { title: "Politica de Privacidade · Liga Metropole" },
      { name: "description", content: "Politica de Privacidade da Liga Metropole Varzea — conformidade com a LGPD." },
    ],
  }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl tracking-wide text-foreground">{title}</h2>
      <div className="text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

function PrivacidadePage() {
  const dataAtualizacao = "05 de junho de 2026";

  return (
    <PublicShell>
      <div className="max-w-3xl mx-auto space-y-10 py-4">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-display text-5xl tracking-wide">Politica de Privacidade</h1>
          <p className="text-muted-foreground text-sm">
            Ultima atualizacao: {dataAtualizacao} &mdash; Em conformidade com a Lei Geral de Protecao de Dados (Lei n&deg; 13.709/2018 &mdash; LGPD)
          </p>
        </div>

        <Section title="1. Quem somos">
          <p>
            A <strong className="text-foreground">Liga Metropole Varzea</strong> e uma competicao amadora de futebol de varzea organizada na regiao metropolitana de Sao Paulo.
            O responsavel pelo tratamento dos seus dados pessoais e o administrador da liga, cujo contato esta indicado na secao 9 desta politica.
          </p>
        </Section>

        <Section title="2. Dados coletados">
          <p>Coletamos os seguintes dados pessoais para operacao da plataforma:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-foreground">Nome completo</strong> — identificacao do usuario e do atleta</li>
            <li><strong className="text-foreground">CPF</strong> — verificacao de identidade do atleta (armazenado em hash bcrypt; nunca exposto em texto claro)</li>
            <li><strong className="text-foreground">Numero de WhatsApp</strong> — comunicacao sobre jogos e notificacoes da liga</li>
            <li><strong className="text-foreground">Endereco de e-mail</strong> — autenticacao, comunicacao oficial e notificacoes automaticas</li>
            <li><strong className="text-foreground">Foto do atleta</strong> — composicao do ID Metropole e exibicao no perfil publico</li>
            <li><strong className="text-foreground">Instagram (opcional)</strong> — exibicao no perfil publico do atleta</li>
            <li><strong className="text-foreground">Dados de desempenho</strong> — gols, assistencias, notas de destaque e historico de partidas gerados durante a competicao</li>
          </ul>
        </Section>

        <Section title="3. Finalidade do tratamento">
          <p>Seus dados sao utilizados exclusivamente para:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Gestao e administracao da liga (inscricao de times, sorteios, tabela de jogos)</li>
            <li>Geracao e exibicao do ID Metropole — credencial digital do atleta</li>
            <li>Comunicacao sobre jogos agendados, sumulas e resultados</li>
            <li>Calculo e exibicao de estatisticas publicas (artilharia, nota Metropole, disciplina)</li>
            <li>Controle financeiro interno (pagamentos das taxas da liga)</li>
            <li>Envio de notificacoes por e-mail e, futuramente, WhatsApp</li>
          </ul>
        </Section>

        <Section title="4. Base legal do tratamento">
          <p>O tratamento dos seus dados fundamenta-se nas seguintes hipoteses previstas na LGPD:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>
              <strong className="text-foreground">Execucao de contrato</strong> (Art. 7&deg;, V) — dados necessarios para inscricao e participacao na liga.
            </li>
            <li>
              <strong className="text-foreground">Consentimento</strong> (Art. 7&deg;, I) — dados opcionais como foto e Instagram, fornecidos voluntariamente pelo titular.
            </li>
            <li>
              <strong className="text-foreground">Legitimo interesse</strong> (Art. 7&deg;, IX) — exibicao de estatisticas publicas de desempenho esportivo.
            </li>
          </ul>
        </Section>

        <Section title="5. Tempo de retencao dos dados">
          <p>
            Seus dados sao mantidos pelo periodo necessario para o cumprimento das finalidades descritas acima,
            respeitando os seguintes criterios:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Dados de conta e perfil: ate 90 dias apos a solicitacao de exclusao da conta</li>
            <li>Historico esportivo (sumulas, gols, notas): podem ser mantidos de forma anonimizada para fins estatisticos</li>
            <li>Registros financeiros: 5 anos, conforme exigencia legal (legislacao tributaria)</li>
            <li>Dados de acesso e seguranca: ate 6 meses apos o encerramento da sessao</li>
          </ul>
          <p>
            Apos o prazo, os dados sao excluidos ou anonimizados de forma irreversivel.
          </p>
        </Section>

        <Section title="6. Compartilhamento de dados">
          <p>
            Nao vendemos nem comercializamos seus dados. Compartilhamos apenas quando estritamente necessario:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-foreground">Supabase</strong> — provedor de banco de dados e autenticacao (servidores nos EUA com clausulas contratuais padrao)</li>
            <li>Autoridades publicas, quando exigido por lei</li>
          </ul>
        </Section>

        <Section title="7. Direitos do titular">
          <p>Voce tem os seguintes direitos garantidos pela LGPD (Art. 18):</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-foreground">Acesso</strong> — solicitar confirmacao e copia dos seus dados tratados</li>
            <li><strong className="text-foreground">Correcao</strong> — corrigir dados incompletos, inexatos ou desatualizados (disponivel em Minha Conta)</li>
            <li><strong className="text-foreground">Exclusao</strong> — solicitar a eliminacao dos seus dados (disponivel em{" "}
              <Link to="/minha-conta/excluir-conta" className="text-primary hover:underline">
                Minha Conta &rsaquo; Excluir Conta
              </Link>
              )
            </li>
            <li><strong className="text-foreground">Portabilidade</strong> — receber seus dados em formato estruturado (solicite por e-mail)</li>
            <li><strong className="text-foreground">Revogacao do consentimento</strong> — retirar o consentimento a qualquer momento</li>
            <li><strong className="text-foreground">Oposicao</strong> — opor-se a tratamento com base em legitimo interesse</li>
          </ul>
        </Section>

        <Section title="8. Cookies e dados técnicos">
          <p>
            Utilizamos cookies essenciais de sessao para autenticacao. Nao utilizamos cookies de rastreamento
            ou publicidade de terceiros. Dados técnicos como endereco IP podem ser registrados pelos provedores
            de infraestrutura para fins de seguranca.
          </p>
        </Section>

        <Section title="9. Contato do responsavel pelo tratamento">
          <p>
            Para exercer seus direitos ou esclarecer duvidas sobre esta politica, entre em contato com o
            responsavel pelo tratamento de dados da Liga Metropole:
          </p>
          <div className="rounded-lg border border-border bg-card p-4 space-y-1 text-sm">
            <p><strong className="text-foreground">Liga Metropole Varzea</strong></p>
            <p>E-mail:{" "}
              <a href="mailto:shelderdouglasdacruz@gmail.com" className="text-primary hover:underline">
                shelderdouglasdacruz@gmail.com
              </a>
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Prazo de resposta: ate 15 dias uteis, conforme Art. 19 da LGPD.
            </p>
          </div>
        </Section>

        <Section title="10. Alteracoes nesta politica">
          <p>
            Esta politica pode ser atualizada periodicamente. Notificaremos os usuarios sobre mudancas
            relevantes por e-mail ou por aviso na plataforma. A versao atual sera sempre disponibilizada
            nesta pagina com a data de ultima atualizacao.
          </p>
        </Section>

        <div className="border-t border-border pt-6 flex gap-4 text-sm text-muted-foreground">
          <Link to="/termos" className="text-primary hover:underline">Termos de Uso</Link>
          <Link to="/" className="hover:underline">Pagina inicial</Link>
        </div>
      </div>
    </PublicShell>
  );
}
