-- Non-transactional festival member registrations only.
-- No advance collection, product reservation, or redemption entitlement is created.
CREATE TABLE IF NOT EXISTS festival_members (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 membership_code varchar(38) NOT NULL UNIQUE,
 scheme_year integer NOT NULL CHECK (scheme_year BETWEEN 2020 AND 2100),
 full_name varchar(120) NOT NULL,
 phone varchar(15) NOT NULL,
 email varchar(254),
 duration_months smallint NOT NULL CHECK(duration_months IN (6,10,12)),
 status varchar(24) NOT NULL DEFAULT 'REGISTERED'
   CHECK(status IN ('REGISTERED','VERIFIED','CANCELLED')),
 consented_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 verified_by bigint REFERENCES app_users(id),
 CONSTRAINT festival_member_unique_application UNIQUE(scheme_year,phone,duration_months)
);
CREATE INDEX IF NOT EXISTS festival_members_created_idx ON festival_members(created_at DESC);
CREATE TABLE IF NOT EXISTS festival_store_visits (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 member_id bigint NOT NULL REFERENCES festival_members(id),
 recorded_by bigint NOT NULL REFERENCES app_users(id),
 notes varchar(500) NOT NULL DEFAULT '',
 visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS festival_store_visits_member_idx ON festival_store_visits(member_id,visited_at DESC);
