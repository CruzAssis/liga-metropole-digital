// Definicao unica de "partida encerrada".
//
// Antes cada modulo tinha a sua, e por isso as paginas discordavam:
//   calendario/estatisticas/torcedor : confirmed, closed, wo   (correta)
//   stats (artilharia publica)       : confirmed, wo           -> perdia 'closed'
//   atleta-profile                   : confirmed, wo, finished -> 'finished' nao
//                                                                existe no enum
//   discipline                       : confirmed, closed       -> perdia 'wo'
//
// Efeito pratico: o mesmo atleta aparecia com contagem de jogos diferente na
// artilharia, no perfil dele e na pagina de estatisticas. Para uma liga cuja
// promessa de venda e "a tabela nao some", numero que muda de pagina para
// pagina custa mais credibilidade do que bug de layout.
//
// Enum real de matches.status (ver admin-matches.functions.ts):
//   scheduled | awaiting_confirmation | confirmed | closed | disputed | wo | cancelled

/** Partida com resultado valendo: entra em classificacao, artilharia e disciplina. */
export const FINISHED_STATUSES = ["confirmed", "closed", "wo"] as const;

export type FinishedStatus = (typeof FINISHED_STATUSES)[number];

/** Copia mutavel, para as APIs que pedem string[] (ex.: supabase .in()). */
export const FINISHED: string[] = [...FINISHED_STATUSES];

export function isFinished(status: string | null | undefined): boolean {
  return !!status && (FINISHED_STATUSES as readonly string[]).includes(status);
}
