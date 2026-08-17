-- Staff ops RPCs write audit rows on targeted search; must not be STABLE.
alter function public.list_early_access_waitlist_ops(
  text, text, text, text, text, integer, integer
) volatile;

alter function public.list_student_account_ops(
  text, text, integer, integer
) volatile;
