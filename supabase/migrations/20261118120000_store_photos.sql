-- =============================================================================
-- Store product photos (Fog of the Dragon)
-- Each official store product gets a real photo of the product type (Wikimedia Commons, free licenses; see
-- Assets/Pictures/store/ATTRIBUTION.md) with its credit line. The FOD print design (art) stays the design shown on the item.
-- Also renames one product whose name echoed a well-known fictional inn.
-- Run after 20261117120000_marketplace.sql. Safe to run again.
-- =============================================================================

do $$
begin
  if to_regclass('public.marketplace_store_products') is null then
    raise exception 'Run 20261117120000_marketplace.sql first.';
  end if;
end;
$$;

alter table public.marketplace_store_products add column if not exists photo text check (photo is null or photo ~ '^Assets/Pictures/store/[a-z0-9-]+.(jpg|png|webp)$');
alter table public.marketplace_store_products add column if not exists photo_credit text check (photo_credit is null or char_length(photo_credit) <= 300);
alter table public.marketplace_store_products add column if not exists photo_source text check (photo_source is null or photo_source ~ '^https://commons.wikimedia.org/');

update public.marketplace_store_products p set photo = v.photo, photo_credit = v.credit, photo_source = v.source
from (values
  ('beanie-dragon', 'Assets/Pictures/store/beanie-dragon.jpg', 'Photo: Olivia Craftox, CC BY-SA 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Slouchy_beanie_with_stars._Jacquard_knitting_pattern.jpg'),
  ('campaign-notebook', 'Assets/Pictures/store/campaign-notebook.jpg', 'Photo: Pink Sherbet Photography from USA, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Blank_Pages_In_An_Open_Notebook_(4812269151).jpg'),
  ('cap-crit', 'Assets/Pictures/store/cap-crit.jpg', 'Photo: Original photograph by TexasRebel (derivative by ReneeWrites), CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Baseball_cap.png'),
  ('cup-travel-nat20', 'Assets/Pictures/store/cup-travel-nat20.jpg', 'Photo: Brugo, CC BY 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Travel_mug.jpg'),
  ('dice-set-mimic', 'Assets/Pictures/store/dice-set-mimic.jpg', 'Photo: Dietmar Rabich, CC BY-SA 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:W%C3%BCrfel,_Ikosaeder_(W20)_--_2021_--_5634.jpg'),
  ('dice-bag-hoard', 'Assets/Pictures/store/dice-bag-hoard.jpg', 'Photo: Arm Storage from Hong Kong, Hong Kong, CC BY-SA 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:D%26D_Dice_Bag_(15051489919).jpg'),
  ('dice-set-dragonfire', 'Assets/Pictures/store/dice-set-dragonfire.jpg', 'Photo: Diacritica, CC BY-SA 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Dice_(typical_role_playing_game_dice).jpg'),
  ('d20-nat1-resin', 'Assets/Pictures/store/d20-nat1-resin.jpg', 'Photo: Stephan Sprinz, CC BY 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Self-made_polyhedral_dice_01.jpg'),
  ('dice-tower-keep', 'Assets/Pictures/store/dice-tower-keep.jpg', 'Photo: SteveBaker, CC BY-SA 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:HalfTImberedDiceTower.jpg'),
  ('dice-tray-fog', 'Assets/Pictures/store/dice-tray-fog.jpg', 'Photo: yoppy from Kawasaki, Kanagawa, Japan, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:I_bought_new_china_as_a_dice_tray._(8011365541).jpg'),
  ('dm-screen-fog', 'Assets/Pictures/store/dm-screen-fog.jpg', 'Photo: Graham Campbell from Glasgow, Scotland, CC BY-SA 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:View_from_behind_the_screen_(8735516858).jpg'),
  ('hoodie-fog', 'Assets/Pictures/store/hoodie-fog.jpg', 'Photo: Premeditated, CC BY-SA 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Holzweiler_hanger_hoodie_(upper).jpg'),
  ('mini-bases-pack', 'Assets/Pictures/store/mini-bases-pack.jpg', 'Photo: MagHoxpox, CC BY-SA 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Tabletop-Saga.jpg'),
  ('mousepad-initiative', 'Assets/Pictures/store/mousepad-initiative.jpg', 'Photo: Jeff Sheldon ugmonk, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Overhead_desktop_workspace_(Unsplash).jpg'),
  ('mug-dm-tears', 'Assets/Pictures/store/mug-dm-tears.jpg', 'Photo: www.Pixel.la Free Stock Photos, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Black-and-white-coffee-cup-mug_(23698833853)_(cropped).jpg'),
  ('mug-tavern', 'Assets/Pictures/store/mug-tavern.jpg', 'Photo: Janko Ferlic, CC0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:White_Ceramic_Mug_Filled_With_Coffee_Beside_Coffee_Beans_(43087322071).jpg'),
  ('notebook-spellbook', 'Assets/Pictures/store/notebook-spellbook.jpg', 'Photo: Sam Wilson, CC BY-SA 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:William_Shakespeare_Hall%27s_1861_journal_01.jpg'),
  ('poster-dragon-map', 'Assets/Pictures/store/poster-dragon-map.jpg', 'Photo: Yale University Press, Public domain, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Vinland_Map_HiRes.jpg'),
  ('stickers-crit-fails', 'Assets/Pictures/store/stickers-crit-fails.jpg', 'Photo: nclm, CC BY-SA 4.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Dot_stickers_-_Large_-_1_sheet.jpg'),
  ('tee-mimic', 'Assets/Pictures/store/tee-mimic.jpg', 'Photo: Juan de Vojníkov, CC BY-SA 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Ironed_black_T-shirt_(003).JPG'),
  ('tee-nat1-club', 'Assets/Pictures/store/tee-nat1-club.jpg', 'Photo: Juan de Vojníkov, CC BY-SA 3.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Ironed_black_T-shirt_(001).JPG'),
  ('tee-trust-dm', 'Assets/Pictures/store/tee-trust-dm.jpg', 'Photo: THOR, CC BY 2.0, via Wikimedia Commons', 'https://commons.wikimedia.org/wiki/File:Ringflash_Tshirt_Blank_Template_(3214240974).jpg')
) as v (sku, photo, credit, source)
where p.sku = v.sku;

update public.marketplace_store_products set name = 'Mug: The Tavern Keeper' where sku = 'mug-tavern' and name = 'Mug: The Prancing Tavern Keeper';
