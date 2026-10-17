-- Pro již existující databázi Knihio: fotografie, medailonky a logo nakladatele.
begin;
alter table public.knihio_books add column if not exists author_photo_url text not null default '';
alter table public.knihio_books add column if not exists author_bio text not null default '';
alter table public.knihio_books add column if not exists illustrator_photo_url text not null default '';
alter table public.knihio_books add column if not exists illustrator_bio text not null default '';
alter table public.knihio_books add column if not exists publisher_logo_url text not null default '';
commit;
