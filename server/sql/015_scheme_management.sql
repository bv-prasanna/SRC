-- Scheme product configuration. These are internal/publicly visible descriptions,
-- NOT authorization to charge recurring payments or accept deposits.
CREATE TABLE IF NOT EXISTS src_scheme_plans (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 code varchar(40) NOT NULL UNIQUE,
 name varchar(120) NOT NULL,
 scheme_year integer NOT NULL CHECK (scheme_year BETWEEN 2020 AND 2100),
 duration_months smallint NOT NULL CHECK(duration_months IN (6,10,12)),
 frequency varchar(12) NOT NULL CHECK(frequency IN ('MONTHLY','QUARTERLY')),
 billing_cycles smallint NOT NULL CHECK(billing_cycles BETWEEN 2 AND 12),
 amount_paise integer NOT NULL CHECK(amount_paise BETWEEN 100 AND 100000000),
 description varchar(1000) NOT NULL DEFAULT '',
 benefits varchar(1000) NOT NULL DEFAULT '',
 terms_summary varchar(3000) NOT NULL DEFAULT '',
 internal_notes varchar(4000) NOT NULL DEFAULT '',
 start_date date,
 end_date date,
 max_members integer CHECK(max_members IS NULL OR max_members BETWEEN 1 AND 1000000),
 status varchar(20) NOT NULL DEFAULT 'DRAFT'
    CHECK(status IN ('DRAFT','IN_REVIEW','PUBLISHED','ARCHIVED')),
 razorpay_plan_id varchar(100),
 gateway_status varchar(24) NOT NULL DEFAULT 'NOT_ENABLED'
    CHECK(gateway_status='NOT_ENABLED'),
 created_by bigint REFERENCES app_users(id),
 updated_by bigint REFERENCES app_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1,
 CONSTRAINT scheme_plan_dates CHECK(start_date IS NULL OR end_date IS NULL OR end_date>=start_date)
);
CREATE INDEX IF NOT EXISTS src_scheme_plans_public_idx
 ON src_scheme_plans(status,scheme_year,duration_months);
CREATE TABLE IF NOT EXISTS src_scheme_plan_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 scheme_plan_id bigint NOT NULL REFERENCES src_scheme_plans(id),
 actor_id bigint REFERENCES app_users(id),
 action varchar(24) NOT NULL CHECK(action IN ('CREATE','EDIT','STATUS')),
 previous_state jsonb,
 next_state jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE festival_members
 ADD COLUMN IF NOT EXISTS scheme_plan_id bigint REFERENCES src_scheme_plans(id);
CREATE INDEX IF NOT EXISTS festival_members_plan_idx ON festival_members(scheme_plan_id);
