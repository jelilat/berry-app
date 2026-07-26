alter table public.projects
  add column if not exists is_shared boolean not null default false;

alter table public.projects
  add column if not exists shared_at timestamptz;

create or replace function public.get_shared_project(project_id uuid)
returns table (
  id uuid,
  name text,
  board text,
  project_json jsonb,
  firmware_files jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    projects.id,
    projects.name,
    projects.board,
    projects.project_json,
    projects.firmware_files,
    projects.updated_at
  from public.projects
  where projects.id = project_id
    and projects.is_shared = true
  limit 1;
$$;

revoke all on function public.get_shared_project(uuid) from public;
grant execute on function public.get_shared_project(uuid) to anon, authenticated;
