-- Remove chat module tables from Supabase
-- Run once in: Dashboard → SQL Editor → New query → Run

drop policy if exists chat_messages_authenticated_all on public.chat_messages;
drop policy if exists chat_threads_authenticated_all on public.chat_threads;

drop index if exists public.chat_messages_thread_id_idx;

drop table if exists public.chat_messages cascade;
drop table if exists public.chat_threads cascade;
