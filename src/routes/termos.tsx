import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/PublicShell";

export const Route = createFileRoute("/termos")({
  component: TermosPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso · Liga Metropole" },
      { name: "description", content: "Termos de Uso da Liga Metropole Varzea." },
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

function TermosPage() {
  const dataAtualizacao = "05 de junho de 2026";

  return (
    <PublicShell>
      <div className="max-w-3xl mx-auto space-y-10 py-4">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-display text-5xl tracking-wide">Termos de Uso</h1>
          <p className="text-muted-foreground text-sm">
            Ultima atualizacao: {dataAtualizacao}
          </p>
        </div>

        <Section title="1. Aceitacao dos termos">
          <p>
            Ao criar uma conta e utilizar a plataforma <strong className="text-foreground">Liga Metropole</strong> (ligametropole.app),
            voce concorda com estes Termos de Uso e com nossa{" "}
            <Link to="/privacidade" className="text-primary hover:underline">Politica de Privacidade</Link>.
            Caso nao concorde, nao utilize a plataforma.
          </p>
        </Section>

        <Section title="2. Descricao do servico">
          <p>
            A Liga Metropole e uma plataforma digital de gestao de competicoes amadoras de futebol de varzea,
            oferecendo recursos de inscricao de times, tabela de jogos, sumula digital, ranking de atletas
            e identidade digital do jogador (ID Metropole).
          </p>
        </Section>

        <Section title="3. Cadastro e elegibilidade">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Voce deve ter no minimo 18 anos para criar uma conta como Diretor ou Jogador.</li>
            <li>As informacoes fornecidas no cadastro devem ser verdadeiras, precisas e atualizadas.</li>
            <li>Voce e responsavel pela seguranca da sua senha e por todas as acoes realizadas em sua conta.</li>
            <li>E vedado criar contas em nome de terceiros sem autorizacao expressa.</li>
          </ul>
        </Section>

        <Section title="4. Regras de participacao na liga">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Cada Diretor pode inscrever apenas um time por temporada.</li>
            <li>Os times devem respeitar o regulamento esportivo divulgado pela organizacao.</li>
            <li>A inscricao esta sujeita a aprovacao pela organizacao da liga.</li>
            <li>O nao pagamento das taxas mensais pode resultar na suspensao do time da competicao.</li>
            <li>O descumprimento do regulamento esportivo pode acarretar penalidades, incluindo desclassificacao.</li>
          </ul>
        </Section>

        <Section title="5. Sumula digital e integridade dos dados">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>O preenchimento da sumula digital e de responsabilidade do Diretor de cada time dentro do prazo estabelecido.</li>
            <li>O nao preenchimento da sumula no prazo implica W.O. automatico, conforme regulamento.</li>
            <li>E terminantemente proibido inserir informacoes falsas na sumula. Tal conduta pode resultar em punicoes esportivas e exclusao da plataforma.</li>
            <li>As estatisticas publicadas sao geradas automaticamente a partir das sumulas e podem ser questionadas via e-mail de contato.</li>
          </ul>
        </Section>

        <Section title="6. ID Metropole">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>O ID Metropole e uma credencial digital pessoal e intransferivel.</li>
            <li>A verificacao do atleta e feita por CPF; fornecer CPF falso ou de terceiro configura irregularidade grave.</li>
            <li>O QR Code do ID Metropole pode ser apresentado fisicamente no dia do jogo para confirmacao de identidade.</li>
            <li>O perfil publico do atleta exibe nome, foto, time, posicao e estatisticas. Dados sensiveis (CPF, WhatsApp) nunca sao exibidos publicamente.</li>
          </ul>
        </Section>

        <Section title="7. Conduta do usuario">
          <p>E vedado:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Utilizar a plataforma para fins ilegais ou que violem direitos de terceiros.</li>
            <li>Publicar conteudo ofensivo, discriminatorio ou que incite violencia.</li>
            <li>Tentar acessar contas alheias ou explorar vulnerabilidades do sistema.</li>
            <li>Usar robos, scrapers ou qualquer automacao nao autorizada.</li>
            <li>Reproduzir, distribuir ou modificar o conteudo da plataforma sem autorizacao.</li>
          </ul>
        </Section>

        <Section title="8. Propriedade intelectual">
          <p>
            A marca Liga Metropole, o design e os textos da plataforma sao propriedade exclusiva dos organizadores.
            O conteudo gerado pelos usuarios (fotos, dados de perfil) permanece de sua propriedade, com licenca
            de uso concedida a plataforma para exibicao dentro do servico.
          </p>
        </Section>

        <Section title="9. Exclusao de conta e dados">
          <p>
            Voce pode solicitar a exclusao da sua conta a qualquer momento em{" "}
            <Link to="/_authenticated/minha-conta/excluir-conta" className="text-primary hover:underline">
              Minha Conta &rsaquo; Excluir Conta
            </Link>
            . Apos a exclusao, seus dados serao removidos conforme a{" "}
            <Link to="/privacidade" className="text-primary hover:underline">Politica de Privacidade</Link>.
          </p>
        </Section>

        <Section title="10. Limitacao de responsabilidade">
          <p>
            A Liga Metropole nao se responsabiliza por:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Incidentes fisicos ocorridos durante as partidas (lesoes, acidentes)</li>
            <li>Interrupcoes do servico por razoes tecnicas ou de forca maior</li>
            <li>Conteudo publicado por outros usuarios</li>
            <li>Uso indevido das credenciais de acesso pelo titular</li>
          </ul>
        </Section>

        <Section title="11. Alteracoes nos termos">
          <p>
            Reservamo-nos o direito de alterar estes Termos a qualquer momento.
            Alteracoes substanciais serao comunicadas por e-mail com pelo menos 15 dias de antecedencia.
            O uso continuado da plataforma apos as alteracoes implica aceitacao dos novos Termos.
          </p>
        </Section>

        <Section title="12. Contato">
          <p>
            Para duvidas, questionamentos ou exercicio de direitos, entre em contato:
          </p>
          <div className="rounded-lg border border-border bg-card p-4 space-y-1 text-sm">
            <p><strong className="text-foreground">Liga Metropole Varzea</strong></p>
            <p>E-mail:{" "}
              <a href="mailto:shelderdouglasdacruz@gmail.com" className="text-primary hover:underline">
                shelderdouglasdacruz@gmail.com
              </a>
            </p>
          </div>
        </Section>

        <div className="border-t border-border pt-6 flex gap-4 text-sm text-muted-foreground">
          <Link to="/privacidade" className="text-primary hover:underline">Politica de Privacidade</Link>
          <Link to="/" className="hover:underline">Pagina inicial</Link>
        </div>
      </div>
    </PublicShell>
  );
}
