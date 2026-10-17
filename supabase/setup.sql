-- KNIHIO: kompletní nastavení databáze v Supabase.
-- Vložte celý soubor do SQL Editoru a spusťte Run.
-- Lze spustit opakovaně. Existující knihy se nemažou.
-- Přihlášení a účty spravuje Supabase Auth (auth.users).

begin;

create table if not exists public.knihio_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  title text not null
    check (length(trim(title)) > 0 and length(title) <= 300),
  author text not null default '',
  illustrator text not null default '',
  isbn text not null default '',
  publisher text not null default '',
  year text not null default '',
  pages integer check (pages is null or pages between 1 and 100000),
  language text not null default '',
  genre text not null default '',
  status text not null default 'unread'
    check (status in ('unread', 'reading', 'read', 'wishlist')),
  rating integer not null default 0 check (rating between 0 and 5),
  owned boolean not null default true,
  cover_url text not null default '',
  description text not null default '',
  notes text not null default '',
  author_photo_url text not null default '',
  author_bio text not null default '',
  illustrator_photo_url text not null default '',
  illustrator_bio text not null default '',
  publisher_logo_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Doplnění nových polí do starší verze Knihio.
alter table public.knihio_books
  add column if not exists author_photo_url text not null default '',
  add column if not exists author_bio text not null default '',
  add column if not exists illustrator_photo_url text not null default '',
  add column if not exists illustrator_bio text not null default '',
  add column if not exists publisher_logo_url text not null default '';

create index if not exists knihio_books_user_created
  on public.knihio_books (user_id, created_at desc);

-- Stejné ISBN smí mít různí uživatelé; prázdné ISBN lze použít opakovaně.
create unique index if not exists knihio_books_user_isbn
  on public.knihio_books (user_id, isbn) where isbn <> '';

alter table public.knihio_books enable row level security;
revoke all on public.knihio_books from anon;
revoke all on public.knihio_books from public;
grant usage on schema public to authenticated;
grant select, insert, update, delete
  on public.knihio_books to authenticated;

-- Každý přihlášený uživatel smí pracovat pouze se svými knihami.
drop policy if exists knihio_select_own on public.knihio_books;
create policy knihio_select_own on public.knihio_books
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists knihio_insert_own on public.knihio_books;
create policy knihio_insert_own on public.knihio_books
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists knihio_update_own on public.knihio_books;
create policy knihio_update_own on public.knihio_books
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists knihio_delete_own on public.knihio_books;
create policy knihio_delete_own on public.knihio_books
  for delete to authenticated
  using ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
commit;
