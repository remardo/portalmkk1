alter table public.shop_products
  add column if not exists image_data_base64 text null,
  add column if not exists image_mime_type text null;

