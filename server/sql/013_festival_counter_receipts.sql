-- Links an independently issued physical-store receipt to a verified member.
-- This does not create an online sale, payment, online reservation or benefit entitlement.
CREATE TABLE IF NOT EXISTS festival_counter_receipts (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 member_id bigint NOT NULL REFERENCES festival_members(id),
 receipt_reference varchar(60) NOT NULL UNIQUE,
 recorded_by bigint NOT NULL REFERENCES app_users(id),
 notes varchar(500) NOT NULL DEFAULT '',
 recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS festival_counter_receipts_member_idx ON festival_counter_receipts(member_id,recorded_at DESC);
