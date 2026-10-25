CREATE TABLE IF NOT EXISTS standard_orders (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 customer_name varchar(120) NOT NULL,
 email varchar(254) NOT NULL,
 phone varchar(20) NOT NULL,
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 status varchar(20) NOT NULL DEFAULT 'ENQUIRY' CHECK(status IN ('ENQUIRY','CANCELLED','CLOSED')),
 total_paise bigint NOT NULL CHECK(total_paise>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT no_firework_standard_order CHECK(section_slug<>'crackers')
);
CREATE TABLE IF NOT EXISTS standard_order_lines (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES standard_orders(id),
 product_id bigint NOT NULL REFERENCES products(id),
 quantity integer NOT NULL CHECK(quantity BETWEEN 1 AND 100),
 unit_price_paise integer NOT NULL CHECK(unit_price_paise>=0)
);
CREATE INDEX IF NOT EXISTS standard_orders_created_idx ON standard_orders(created_at DESC);
