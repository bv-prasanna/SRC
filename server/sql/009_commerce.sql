-- Standard-goods checkout only. Never use these tables for crackers or scheme collections.
CREATE TABLE IF NOT EXISTS customer_orders(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES app_users(id),
 section_slug varchar(64) NOT NULL REFERENCES business_sections(slug),
 status varchar(24) NOT NULL DEFAULT 'PENDING_PAYMENT'
   CHECK(status IN ('PENDING_PAYMENT','PAID','PACKING','DISPATCHED','DELIVERED','CANCELLED','EXPIRED','REFUND_PENDING','REFUNDED')),
 amount_paise bigint NOT NULL CHECK(amount_paise>0),
 currency char(3) NOT NULL DEFAULT 'INR',
 address text NOT NULL,
 idem_key varchar(80) NOT NULL,
 razorpay_order_id varchar(100) UNIQUE,
 razorpay_payment_id varchar(100) UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '20 minutes'),
 paid_at timestamptz,
 UNIQUE(user_id,idem_key),
 CONSTRAINT forbid_crackers_checkout CHECK(section_slug<>'crackers')
);
CREATE TABLE IF NOT EXISTS customer_order_items(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES customer_orders(id),
 product_id bigint NOT NULL REFERENCES products(id),
 stock_level_id bigint NOT NULL REFERENCES stock_levels(id),
 name_snapshot varchar(150) NOT NULL,
 qty integer NOT NULL CHECK(qty BETWEEN 1 AND 100),
 unit_price_paise integer NOT NULL CHECK(unit_price_paise>0),
 UNIQUE(order_id,product_id)
);
ALTER TABLE stock_levels ADD COLUMN IF NOT EXISTS reserved integer NOT NULL DEFAULT 0;
ALTER TABLE stock_levels DROP CONSTRAINT IF EXISTS stock_levels_reservation_check;
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_reservation_check CHECK(reserved>=0 AND reserved<=on_hand);
CREATE TABLE IF NOT EXISTS payment_webhook_events(
 event_id varchar(150) PRIMARY KEY,
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS customer_invoices(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL UNIQUE REFERENCES customer_orders(id),
 invoice_number varchar(64) NOT NULL UNIQUE,
 kind varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK(kind IN ('DRAFT','TAX_INVOICE')),
 snapshot jsonb NOT NULL,
 generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE standard_orders ADD COLUMN IF NOT EXISTS assigned_agent_id bigint REFERENCES app_users(id);
CREATE INDEX IF NOT EXISTS standard_orders_agent_idx ON standard_orders(assigned_agent_id);
CREATE TABLE IF NOT EXISTS agent_enquiry_notes(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 enquiry_id bigint NOT NULL REFERENCES standard_orders(id),
 agent_id bigint NOT NULL REFERENCES app_users(id),
 note varchar(1000) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS password_reset_tokens(
 token_hash char(64) PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE INDEX IF NOT EXISTS password_reset_user_idx ON password_reset_tokens(user_id);
