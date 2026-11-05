-- Test-mode Razorpay Subscriptions lifecycle; scheme collection is disabled by default.
-- Never use these tables as evidence that fireworks subscriptions are approved.
CREATE TABLE IF NOT EXISTS src_scheme_subscriptions (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 member_id bigint NOT NULL UNIQUE REFERENCES festival_members(id),
 scheme_plan_id bigint NOT NULL REFERENCES src_scheme_plans(id),
 razorpay_plan_id varchar(100),
 razorpay_subscription_id varchar(100) UNIQUE,
 status varchar(24) NOT NULL DEFAULT 'INITIATING'
    CHECK(status IN ('INITIATING','FAILED','CREATED','AUTHENTICATED','ACTIVE','HALTED','CANCELLED','COMPLETED')),
 cycles_paid integer NOT NULL DEFAULT 0 CHECK(cycles_paid >= 0),
 last_event_at timestamptz,
 failure_reason varchar(200),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS src_scheme_subscription_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 provider_event_id varchar(128) NOT NULL UNIQUE,
 razorpay_subscription_id varchar(100) NOT NULL,
 event_type varchar(80) NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS src_scheme_subscription_events_sub_idx ON src_scheme_subscription_events(razorpay_subscription_id);
