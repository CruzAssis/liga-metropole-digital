REVOKE SELECT (whatsapp, instagram_handle, cpf_last4, cpf_hash) ON public.athletes FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_athlete_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_ranking_craques(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_team_supporter_counts() FROM anon;