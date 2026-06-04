-- GritVib チャット: Realtime publication / replica identity の再適用（未設定環境向け）

do $$
begin
  alter publication supabase_realtime add table public.gritvib_chat_messages;
exception
  when duplicate_object then null;
end $$;

alter table public.gritvib_chat_messages replica identity full;
