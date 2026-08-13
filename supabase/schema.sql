-- QuantLog schema. Run this once in Supabase SQL editor.
-- All access goes through Next.js API routes using the service role key,
-- so RLS stays enabled with no public policies (deny-all to anon).

create table if not exists app_state (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into app_state (id, data) values (1, '{}'::jsonb)
  on conflict (id) do nothing;

create table if not exists struggles (
  id text primary key,
  text_body text default '',
  topic_id text default 'other',
  filed_on date not null,
  answer_text text default '',
  has_photo boolean default false,
  has_ans_photo boolean default false,
  retired boolean default false,
  last_tried date,
  keep_count int default 0,
  created_at timestamptz not null default now()
);

alter table app_state enable row level security;
alter table struggles enable row level security;

-- Storage: create a PRIVATE bucket named "photos" in the dashboard
-- (Storage -> New bucket -> name: photos -> public OFF).
