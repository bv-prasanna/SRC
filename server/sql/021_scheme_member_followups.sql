-- Auditable, manual email follow-ups for already registered scheme members.
-- No recurring payment can be initiated by sending an email.
CREATE TABLE IF NOT EXISTS src_scheme_member_followups (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 member_id bigint NOT NULL REFERENCES festival_members(id),
 scheme_plan_id bigint NOT NULL REFERENCES src_scheme_plans(id),
 actor_user_id bigint NOT NULL REFERENCES app_users(id),
 channel varchar(12) NOT NULL DEFAULT 'EMAIL' CHECK(channel='EMAIL'),
 reason varchar(32) NOT NULL CHECK(reason IN ('AWAITING_SETUP','MANDATE_FAILED','MANDATE_PENDING')),
 delivery_status varchar(16) NOT NULL CHECK(delivery_status IN ('PENDING','SENT','FAILED')),
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz,
 failed_at timestamptz
);
CREATE INDEX IF NOT EXISTS src_scheme_followups_member_idx ON src_scheme_member_followups(member_id,created_at DESC);
CREATE INDEX IF NOT EXISTS src_scheme_followups_plan_idx ON src_scheme_member_followups(scheme_plan_id,created_at DESC);
