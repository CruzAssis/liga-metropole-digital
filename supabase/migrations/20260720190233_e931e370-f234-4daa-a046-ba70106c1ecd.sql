
CREATE TABLE public.notification_templates (
  tipo TEXT PRIMARY KEY,
  assunto TEXT,
  mensagem TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_templates TO authenticated;
GRANT ALL ON public.notification_templates TO service_role;

ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification templates"
  ON public.notification_templates
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_notification_templates_updated_at
  BEFORE UPDATE ON public.notification_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.notification_templates (tipo, assunto, mensagem, variables) VALUES
  ('team_approved',
   'Status do time: {status}',
   E'⚽ Olá {diretor}! O time *{time}* foi *{status_label}* na Liga Metrópole.\n\nAcesse o app para os próximos passos.',
   ARRAY['diretor','time','status','status_label']),
  ('jogo_agendado',
   'Jogo {tipo_evento}',
   E'🏆 *Liga Metrópole* — Jogo {tipo_evento}\n\n{time} x {adversario}\n📅 {data}\n📍 {local}\n\nAcesse o app para detalhes.',
   ARRAY['diretor','time','adversario','data','local','tipo_evento']),
  ('sumula_disponivel',
   'Súmula aguardando validação',
   E'📋 *Súmula pendente* — {time} x {adversario}\n\nPlacar informado: {placar_casa} x {placar_visitante}\n\nAcesse o app para *validar ou contestar* em até 72h.',
   ARRAY['diretor','time','adversario','placar_casa','placar_visitante']),
  ('sumula_prazo_alerta',
   'Prazo da súmula acabando',
   E'⏰ Atenção {diretor}! A súmula de *{time} x {adversario}* vence em {horas_restantes}h. Preencha para evitar W.O.',
   ARRAY['diretor','time','adversario','horas_restantes']),
  ('destaque_publicado',
   'Destaque publicado',
   E'⭐ *Destaque da partida!* — {time}\n\n*{atleta}* foi eleito destaque pelo adversário com nota *{nota}/10*.\n\nParabéns! Confira no app.',
   ARRAY['diretor','time','atleta','nota']),
  ('broadcast',
   'Mensagem da Liga',
   E'{mensagem}',
   ARRAY['diretor','mensagem'])
ON CONFLICT (tipo) DO NOTHING;
