CREATE TABLE IF NOT EXISTS app_users (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 email varchar(254) NOT NULL UNIQUE,
 password_hash text NOT NULL,
 role varchar(16) NOT NULL CHECK(role IN ('CUSTOMER','AGENT','ADMIN')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_sessions (
 token_hash char(64) PRIMARY KEY,
 user_id bigint NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_sessions_expiry_idx ON user_sessions(expires_at);
