-- =============================================================================
-- Fog of the Dragon — images for adventures and homebrew
--
-- Bucket "content-images" is PRIVATE: images are read through short-lived signed URLs, and only by their owner,
-- because adventures and homebrew are private. Each user can read, upload, replace or delete files only inside
-- their own folder:  content-images/<user id>/<adventures|homebrew>/<entry id>/<file>.jpg
-- The app resizes images in the browser (JPEG, at most 1600 px); the bucket refuses files over 2 MB.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-images', 'content-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Content images: read own files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Content images: upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'content-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (storage.foldername(name))[2] in ('adventures', 'homebrew')
  );

create policy "Content images: replace own files"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Content images: delete own files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'content-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
