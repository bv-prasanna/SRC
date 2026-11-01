-- SRC billing engine v1. All money amounts in paise; rates in basis points.
-- Only STANDARD sections may be sold online. Never attach sales rules to Scheme/Crackers.
CREATE TABLE IF NOT EXISTS src_tax_rules (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(120) NOT NULL,
 component varchar(16) NOT NULL CHECK(component IN ('CGST','SGST','IGST','CESS','OTHER')),
 scope varchar(16) NOT NULL CHECK(scope IN ('SECTION','CATEGORY','PRODUCT','ITEM')),
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 category varchar(100),
 product_id bigint REFERENCES products(id),
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 tax_inclusive boolean NOT NULL DEFAULT false,
 hsn_sac varchar(16),
 active boolean NOT NULL DEFAULT true,
 valid_from timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz,
 created_by bigint REFERENCES app_users(id),
 updated_by bigint REFERENCES app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(section_slug IN ('stationery','housekeeping')),
 CHECK((scope='SECTION' AND category IS NULL AND product_id IS NULL) OR
       (scope='CATEGORY' AND category IS NOT NULL AND product_id IS NULL) OR
       (scope IN ('PRODUCT','ITEM') AND product_id IS NOT NULL)),
 CHECK(valid_until IS NULL OR valid_until>valid_from)
);
CREATE INDEX IF NOT EXISTS src_tax_rules_lookup ON src_tax_rules(section_slug,active,component,valid_from DESC);
CREATE TABLE IF NOT EXISTS src_dynamic_pricing_rules (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(120) NOT NULL,
 scope varchar(16) NOT NULL CHECK(scope IN ('SECTION','CATEGORY','PRODUCT','ITEM')),
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 category varchar(100),
 product_id bigint REFERENCES products(id),
 adjustment_bps integer NOT NULL CHECK(adjustment_bps BETWEEN -9000 AND 20000),
 min_quantity integer NOT NULL DEFAULT 1 CHECK(min_quantity BETWEEN 1 AND 100),
 max_quantity integer CHECK(max_quantity BETWEEN 1 AND 100),
 active boolean NOT NULL DEFAULT true,
 valid_from timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz,
 reason varchar(250) NOT NULL,
 created_by bigint REFERENCES app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(section_slug IN ('stationery','housekeeping')),
 CHECK((scope='SECTION' AND category IS NULL AND product_id IS NULL) OR
       (scope='CATEGORY' AND category IS NOT NULL AND product_id IS NULL) OR
       (scope IN ('PRODUCT','ITEM') AND product_id IS NOT NULL)),
 CHECK(max_quantity IS NULL OR max_quantity>=min_quantity),
 CHECK(valid_until IS NULL OR valid_until>valid_from)
);
CREATE INDEX IF NOT EXISTS src_dynamic_rules_lookup ON src_dynamic_pricing_rules(section_slug,active,valid_from DESC);
CREATE TABLE IF NOT EXISTS src_sales_offers (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name varchar(120) NOT NULL,
 code varchar(36) UNIQUE,
 scope varchar(16) NOT NULL CHECK(scope IN ('SECTION','CATEGORY','PRODUCT','ITEM')),
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 category varchar(100),
 product_id bigint REFERENCES products(id),
 kind varchar(12) NOT NULL CHECK(kind IN ('PERCENT','FIXED')),
 value integer NOT NULL CHECK(value>0),
 min_subtotal_paise bigint NOT NULL DEFAULT 0 CHECK(min_subtotal_paise>=0),
 max_discount_paise bigint CHECK(max_discount_paise IS NULL OR max_discount_paise>0),
 active boolean NOT NULL DEFAULT false,
 valid_from timestamptz NOT NULL DEFAULT now(),
 valid_until timestamptz,
 description varchar(400) NOT NULL DEFAULT '',
 created_by bigint REFERENCES app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(section_slug IN ('stationery','housekeeping')),
 CHECK((scope='SECTION' AND category IS NULL AND product_id IS NULL) OR
       (scope='CATEGORY' AND category IS NOT NULL AND product_id IS NULL) OR
       (scope IN ('PRODUCT','ITEM') AND product_id IS NOT NULL)),
 CHECK((kind='PERCENT' AND value BETWEEN 1 AND 10000) OR (kind='FIXED' AND value BETWEEN 1 AND 100000000)),
 CHECK(valid_until IS NULL OR valid_until>valid_from)
);
CREATE INDEX IF NOT EXISTS src_offers_lookup ON src_sales_offers(section_slug,active,valid_from DESC);
CREATE TABLE IF NOT EXISTS src_billing_settings(
 id smallint PRIMARY KEY DEFAULT 1 CHECK(id=1),
 seller_name varchar(150) NOT NULL DEFAULT 'SRC Enterprises',
 seller_gstin varchar(15),
 seller_state_code varchar(2),
 invoice_prefix varchar(20) NOT NULL DEFAULT 'SRC',
 email_invoices boolean NOT NULL DEFAULT false,
 updated_by bigint REFERENCES app_users(id),
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO src_billing_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS src_billing_audit(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 entity varchar(24) NOT NULL CHECK(entity IN ('TAX','PRICING','OFFER','MERCHANT')),
 entity_id bigint,
 action varchar(16) NOT NULL CHECK(action IN ('CREATE','UPDATE','DEACTIVATE','SETTINGS')),
 actor_id bigint REFERENCES app_users(id),
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS coupon_code varchar(36);
ALTER TABLE customer_orders ADD COLUMN IF NOT EXISTS quote_snapshot jsonb;
-- Protect against checkout on new regulated sections even if a future controller is added.
ALTER TABLE customer_orders DROP CONSTRAINT IF EXISTS forbid_nonstandard_checkout;
ALTER TABLE customer_orders ADD CONSTRAINT forbid_nonstandard_checkout CHECK(section_slug IN ('stationery','housekeeping'));
