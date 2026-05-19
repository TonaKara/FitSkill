-- 取引チャット: postgres_changes で相手メッセージをリアルタイム受信するため publication に追加

do $$
begin
  alter publication supabase_realtime add table public.messages;
exception
  when duplicate_object then null;
end $$;

alter table public.messages replica identity full;
