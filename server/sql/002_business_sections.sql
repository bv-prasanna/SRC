-- Run after 001_init.sql. Sections can be extended without code changes.
CREATE TABLE IF NOT EXISTS business_sections (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 slug varchar(64) NOT NULL UNIQUE,
 name varchar(120) NOT NULL,
 description text NOT NULL DEFAULT '',
 commerce_mode varchar(24) NOT NULL CHECK (commerce_mode IN ('CATALOGUE_ONLY','STANDARD')),
 active boolean NOT NULL DEFAULT true,
 sort_order integer NOT NULL DEFAULT 0
);
INSERT INTO business_sections(slug,name,description,commerce_mode,sort_order)
VALUES
 ('crackers','Crackers','Fireworks catalogue and demonstrations; licensed in-person sales only','CATALOGUE_ONLY',10),
 ('housekeeping','Housekeeping Materials','Cleaning and household essentials','STANDARD',20),
 ('stationery','Stationery','Office and school supplies','STANDARD',30)
ON CONFLICT(slug) DO NOTHING;
ALTER TABLE products ADD COLUMN IF NOT EXISTS section_slug varchar(64);
UPDATE products SET section_slug=CASE WHEN fireworks THEN 'crackers' ELSE 'housekeeping' END WHERE section_slug IS NULL;
ALTER TABLE products ALTER COLUMN section_slug SET NOT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_paise integer NOT NULL DEFAULT 0;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_nonnegative;
ALTER TABLE products ADD CONSTRAINT products_price_nonnegative CHECK (price_paise >= 0);
CREATE INDEX IF NOT EXISTS products_section_published_idx ON products(section_slug,published);
-- An explicit guard prevents firework orders even if a future developer implements checkout elsewhere.
CREATE TABLE IF NOT EXISTS retail_orders (
 id bigint GENERATED ALWAYS AS ID PRIMARY KEY,
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 status varchar(24) NOT NULL DEFAULT 'DRAFT',
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT no_fireworks_orders CHECK (section_slug <> 'crackers')
);
