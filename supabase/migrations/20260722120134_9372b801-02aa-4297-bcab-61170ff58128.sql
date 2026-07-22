
-- Athletes: ensure PII columns are not readable by anon/authenticated (defense in depth)
REVOKE SELECT (whatsapp, instagram_handle, cpf_hash, cpf_last4) ON public.athletes FROM anon, authenticated;

-- System settings: revoke direct table SELECT from anon/authenticated; public flags only via SECURITY DEFINER RPCs
REVOKE SELECT ON public.system_settings FROM anon, authenticated;
