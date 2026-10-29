CREATE TABLE IF NOT EXISTS checkout_status_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id bigint NOT NULL REFERENCES customer_orders(id),
 previous_status varchar(24) NOT NULL,
 new_status varchar(24) NOT NULL,
 changed_by bigint REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS checkout_refunds (
 order_id bigint PRIMARY KEY REFERENCES customer_orders(id),
 razorpay_refund_id varchar(100) UNIQUE,
 status varchar(20) NOT NULL DEFAULT 'REQUESTING' CHECK(status IN ('REQUESTING','PENDING','PROCESSED','FAILED')),
 requested_by bigint REFERENCES app_users(id),
 requested_at timestamptz NOT NULL DEFAULT now()
);
