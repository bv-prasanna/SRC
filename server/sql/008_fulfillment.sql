-- Standard goods only: enquiry fulfilment workflow, never fireworks.
ALTER TABLE standard_orders ADD COLUMN IF NOT EXISTS delivery_address text;
ALTER TABLE standard_orders ADD COLUMN IF NOT EXISTS customer_note text;
ALTER TABLE standard_orders ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE standard_orders DROP CONSTRAINT IF EXISTS standard_orders_status_check;
ALTER TABLE standard_orders ADD CONSTRAINT standard_orders_status_check CHECK(status IN ('ENQUIRY','CONFIRMED','PACKING','READY','DISPATCHED','DELIVERED','CANCELLED','CLOSED'));
CREATE TABLE IF NOT EXISTS order_status_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES standard_orders(id),
 old_status varchar(20) NOT NULL,
 new_status varchar(20) NOT NULL,
 note varchar(500) NOT NULL DEFAULT '',
 changed_at timestamptz NOT NULL DEFAULT now()
);
