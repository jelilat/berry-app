create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  board text not null,
  project_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects
  add column if not exists firmware_files jsonb not null default '{}'::jsonb;

alter table public.projects enable row level security;

create policy "Users can read their own projects"
  on public.projects
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on public.projects
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.projects
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.projects
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists projects_user_updated_idx
  on public.projects (user_id, updated_at desc);

create table if not exists public.project_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chat_key text not null,
  chats_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, chat_key)
);

alter table public.project_chats enable row level security;

create policy "Users can read their own project chats"
  on public.project_chats
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own project chats"
  on public.project_chats
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own project chats"
  on public.project_chats
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own project chats"
  on public.project_chats
  for delete
  to authenticated
  using (auth.uid() = user_id);

create index if not exists project_chats_user_updated_idx
  on public.project_chats (user_id, updated_at desc);
