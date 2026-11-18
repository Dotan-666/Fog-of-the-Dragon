-- Affiliate store: replace mock products with real D&D product links.
-- Adds buy_url column, expands categories, and replaces product data.

alter table public.marketplace_store_products add column if not exists buy_url text default '';
alter table public.marketplace_store_products drop constraint if exists marketplace_store_products_category_check;
alter table public.marketplace_store_products add constraint marketplace_store_products_category_check
  check (category in ('dice', 'accessories', 'books', 'clothing', 'everyday'));

-- Remove old mock products
delete from public.marketplace_store_products;

-- Insert real affiliate products
insert into public.marketplace_store_products (sku, category, name, summary, details, art, price_cents, sort, buy_url) values
  -- DICE
  ('hollow-metal-dice', 'dice', 'Hollow Metal Dice Set', 'Intricate hollow metal polyhedral dice with stunning cage designs. Heavy, satisfying rolls.', '{"material":"Metal alloy","pieces":7,"style":"Hollow cage"}', 'dice-set', 2499, 10, 'https://www.aliexpress.com/w/wholesale-dnd-hollow-metal-dice.html'),
  ('metal-dice-premium', 'dice', 'Premium Metal Dice Set', 'Solid metal dice with sharp edges and brilliant finishes. The weight makes every roll feel legendary.', '{"material":"Zinc alloy","pieces":7,"finish":"Various"}', 'dice-set', 2999, 20, 'https://www.amazon.com/s?k=dnd+metal+dice+set'),
  ('liquid-core-dice', 'dice', 'Liquid Core Sharp Edge Dice', 'Transparent resin dice with liquid cores that swirl as you roll. Mesmerizing at the table.', '{"material":"Resin + liquid core","pieces":7,"style":"Sharp edge"}', 'dice-set', 3499, 30, 'https://www.aliexpress.com/w/wholesale-liquid-core-sharp-edge-dice-dnd.html'),
  ('liquid-core-amazon', 'dice', 'Liquid Core Dice Collection', 'Handcrafted sharp-edge dice with captivating liquid centers. Each set unique.', '{"material":"Resin + liquid","pieces":7}', 'dice-set', 3999, 40, 'https://www.amazon.com/s?k=liquid+core+dnd+dice+set'),
  ('led-dice-set', 'dice', 'LED Rechargeable Dice Set', 'Light-up electronic dice that glow in multiple colors. USB rechargeable for endless sessions.', '{"material":"Resin + LED","pieces":7,"battery":"Rechargeable USB"}', 'dice-set', 4999, 50, 'https://www.aliexpress.com/w/wholesale-led-rechargeable-dnd-dice-set.html'),
  ('godice-rpg', 'dice', 'GoDice RPG Connected Dice', 'Smart Bluetooth dice that sync with apps. Roll physical dice, get digital results instantly.', '{"material":"Plastic + Bluetooth","connectivity":"Bluetooth","app":"GoDice"}', 'dice-set', 7999, 60, 'https://www.amazon.com/s?k=GoDice+RPG+connected+dice'),
  ('pixels-dice', 'dice', 'Pixels Electronic Dice', 'The most advanced electronic dice ever made. Full LED display, app-connected, rechargeable.', '{"material":"Electronic","connectivity":"Bluetooth","display":"Full LED","brand":"Pixels"}', 'dice-set', 3999, 70, 'https://gamewithpixels.com/'),
  -- DM SCREENS
  ('dm-screen-leather', 'accessories', 'Faux Leather DM Screen', 'Four-panel faux leather DM screen with a premium feel. Pockets for notes on the DM side.', '{"panels":4,"material":"Faux leather","pockets":true}', 'screen', 2499, 80, 'https://www.aliexpress.com/w/wholesale-dnd-dm-screen-faux-leather.html'),
  ('dm-screen-leather-4p', 'accessories', 'Premium 4-Panel DM Screen', 'Sturdy faux leather DM screen with customizable inserts. The ultimate DM companion.', '{"panels":4,"material":"Faux leather","customizable":true}', 'screen', 2999, 90, 'https://www.amazon.com/s?k=dnd+dm+screen+faux+leather+4+panel'),
  ('dm-screen-official', 'accessories', 'Official D&D DM Screen', 'The official Dungeons & Dragons Dungeon Master screen with reference tables and iconic art.', '{"panels":4,"material":"Cardstock","official":true}', 'screen', 1999, 100, 'https://www.amazon.com/s?k=dungeons+and+dragons+dungeon+master+screen+official'),
  ('dm-screen-wood', 'accessories', 'Wooden DM Screen', 'Handcrafted wooden DM screen with magnetic panels. A centerpiece for any game table.', '{"panels":3,"material":"Wood","magnetic":true}', 'screen', 5999, 110, 'https://www.amazon.com/s?k=wooden+dm+screen+dnd'),
  -- DICE TOWERS & TRAYS
  ('dice-tower-magnetic', 'accessories', 'Magnetic Folding Dice Tower', 'Collapsible dice tower with magnetic assembly. Folds flat for travel, sets up in seconds.', '{"material":"Wood/Leather","foldable":true,"magnetic":true}', 'tower', 2999, 120, 'https://www.aliexpress.com/w/wholesale-folding-magnetic-dice-tower-dnd.html'),
  ('dice-tower-tray', 'accessories', 'Folding Dice Tower & Tray', 'Magnetic folding dice tower with built-in rolling tray. Portable perfection.', '{"material":"Various","foldable":true,"tray":"Built-in"}', 'tower', 2499, 130, 'https://www.amazon.com/s?k=magnetic+folding+dice+tower+tray'),
  ('dice-tower-castle', 'accessories', 'Castle Dice Tower', 'Medieval castle-shaped dice tower. Your dice descend through the fortress for dramatic reveals.', '{"material":"Resin/Wood","style":"Castle","height":"25cm"}', 'tower', 3499, 140, 'https://www.aliexpress.com/w/wholesale-castle-dice-tower-dnd.html'),
  ('dice-tray-leather', 'accessories', 'PU Leather Dice Tray', 'Folding PU leather dice tray. Snaps together for rolling, folds flat for storage.', '{"material":"PU leather","foldable":true,"shape":"Hexagonal"}', 'tray', 1499, 150, 'https://www.aliexpress.com/w/wholesale-folding-pu-leather-dice-tray-dnd.html'),
  -- DICE STORAGE
  ('dice-bag-pockets', 'accessories', 'Dice Bag with Pockets', 'Spacious dice bag with multiple compartments to organize your collection by set or color.', '{"material":"Canvas/Nylon","capacity":"100+ dice","pockets":"Multiple"}', 'bag', 1999, 160, 'https://www.aliexpress.com/w/wholesale-dnd-dice-bag-pockets.html'),
  ('dice-bag-pockets-am', 'accessories', 'Multi-Pocket Dice Organizer', 'Premium dice bag with individual pockets for each set. Never mix up your dice again.', '{"material":"Various","pockets":"Individual set slots"}', 'bag', 2499, 170, 'https://www.amazon.com/s?k=dnd+dice+bag+with+pockets'),
  ('dice-bag-leather', 'accessories', 'Leather Drawstring Dice Bag', 'Classic leather drawstring bag that doubles as a rolling tray. Pull the cord and play.', '{"material":"Leather","doubles_as":"Rolling tray","drawstring":true}', 'bag', 1799, 180, 'https://www.aliexpress.com/w/wholesale-leather-dice-bag-tray-drawstring.html'),
  ('mimic-dice-box', 'accessories', 'Mimic Dice Box', 'A dice storage box shaped like a mimic. Perfect for the DM who loves a good trap.', '{"material":"Resin/Wood","style":"Mimic monster"}', 'chest', 2999, 190, 'https://www.aliexpress.com/w/wholesale-mimic-dice-box-dnd.html'),
  -- BOOKS
  ('phb-2024', 'books', 'Player''s Handbook (2024)', 'The new 2024 D&D Player''s Handbook. Revised rules, updated classes, and stunning new artwork.', '{"edition":"2024","pages":384,"publisher":"Wizards of the Coast"}', 'book', 4999, 200, 'https://www.amazon.com/s?k=Dungeons+%26+Dragons+Player%27s+Handbook+2024'),
  ('phb-5e', 'books', 'Player''s Handbook (5e Classic)', 'The classic 5th Edition Player''s Handbook. The book that started millions of adventures.', '{"edition":"5e 2014","pages":320,"publisher":"Wizards of the Coast"}', 'book', 3499, 210, 'https://www.amazon.com/s?k=Dungeons+%26+Dragons+Player%27s+Handbook+5e'),
  ('core-gift-set', 'books', 'D&D Core Rulebook Gift Set', 'PHB, DMG, and Monster Manual together. The complete foundation for any campaign.', '{"edition":"Various","books":3,"publisher":"Wizards of the Coast"}', 'book', 9999, 220, 'https://www.amazon.com/s?k=Dungeons+%26+Dragons+Core+Rulebook+Gift+Set'),
  -- CLOTHING
  ('dnd-tshirt-funny', 'clothing', 'D&D Funny T-Shirt', 'Hilarious D&D meme shirts for every class and alignment. Because charisma isn''t just a stat.', '{"material":"Cotton","sizes":["S","M","L","XL","XXL"]}', 'tee:D&D MEME', 1499, 230, 'https://www.aliexpress.com/w/wholesale-dnd-funny-t-shirt.html'),
  ('dnd-shirt-meme', 'clothing', 'D&D Meme Shirt Collection', 'Premium D&D humor tees. Nat 1s, mimics, bards — every table joke on cotton.', '{"material":"Cotton blend","sizes":["S","M","L","XL","XXL"]}', 'tee:FUNNY DND', 2499, 240, 'https://www.amazon.com/s?k=dungeons+and+dragons+funny+meme+shirt'),
  ('d20-hat', 'clothing', 'D20 Embroidered Hat', 'Embroidered D20 cap. Roll with style whether you''re at the table or the tavern.', '{"material":"Cotton twill","style":"Embroidered D20","fit":"Adjustable"}', 'cap', 1299, 250, 'https://www.aliexpress.com/w/wholesale-d20-embroidered-hat-dnd.html'),
  -- DRINKWARE & FUN
  ('tankard-medieval', 'everyday', 'Medieval Wooden Tankard', 'Authentic-style wooden beer mug. Because adventurers don''t drink from glass.', '{"material":"Wood","volume":"500 ml","style":"Medieval"}', 'mug:TANKARD', 2499, 260, 'https://www.aliexpress.com/w/wholesale-medieval-wooden-beer-mug-tankard.html'),
  ('d20-coffee-mug', 'everyday', 'D20 Coffee Mug', 'Ceramic coffee mug with D20 designs. Roll for caffeination every morning.', '{"material":"Ceramic","volume":"350 ml"}', 'mug:D20', 1699, 270, 'https://www.amazon.com/s?k=dnd+coffee+mug+d20'),
  -- GAME ACCESSORIES
  ('condition-rings', 'accessories', 'Condition Rings Set', 'Color-coded rings to track conditions on miniatures. No more forgetting who''s poisoned.', '{"material":"Plastic/Silicone","pieces":"40+","conditions":"Labeled"}', 'rings', 1299, 280, 'https://www.aliexpress.com/w/wholesale-dnd-condition-rings.html'),
  ('condition-rings-am', 'accessories', 'Premium Condition Markers', 'High-quality condition ring set with clear labels. Essential for tactical combat.', '{"material":"Various","labeled":true}', 'rings', 1499, 290, 'https://www.amazon.com/s?k=dnd+condition+rings'),
  ('battle-mat', 'accessories', 'Battle Mat (Dry Erase Grid)', 'Double-sided dry erase battle mat with 1-inch grid. Draw any dungeon in minutes.', '{"material":"Vinyl","sides":2,"grid":"1 inch","erasable":true}', 'mat', 2499, 300, 'https://www.amazon.com/s?k=dnd+battle+mat+dry+erase+grid'),
  ('miniatures-bulk', 'accessories', 'Miniatures Bulk Set (28mm)', 'Assorted 28mm fantasy miniatures. Heroes, monsters, NPCs — populate your table.', '{"material":"Plastic/Resin","scale":"28mm","pieces":"Assorted"}', 'minis', 1999, 310, 'https://www.aliexpress.com/w/wholesale-dnd-miniatures-28mm-bulk.html'),
  ('spell-templates', 'accessories', 'Spell AOE Templates', 'Acrylic area-of-effect templates for fireball, cone, line, and more. Never argue about range again.', '{"material":"Acrylic","shapes":"Cone, Circle, Line, Cube"}', 'template', 1499, 320, 'https://www.aliexpress.com/w/wholesale-dnd-spell-aoe-template.html')
on conflict (sku) do update set category = excluded.category, name = excluded.name, summary = excluded.summary,
  details = excluded.details, art = excluded.art, price_cents = excluded.price_cents, sort = excluded.sort, buy_url = excluded.buy_url;
