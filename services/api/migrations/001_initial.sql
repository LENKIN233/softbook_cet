CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  phone_lookup_hash char(64) NOT NULL UNIQUE,
  phone_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  deletion_requested_at timestamptz
);

CREATE TABLE IF NOT EXISTS sms_challenges (
  id uuid PRIMARY KEY,
  phone_lookup_hash char(64) NOT NULL,
  code_hash char(64) NOT NULL,
  attempts_remaining integer NOT NULL CHECK (attempts_remaining >= 0),
  expires_at timestamptz NOT NULL,
  resend_after timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sms_challenges_phone_created_idx
  ON sms_challenges (phone_lookup_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_hash char(64) NOT NULL UNIQUE,
  refresh_hash char(64) NOT NULL UNIQUE,
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  rotated_from uuid REFERENCES auth_sessions(id),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions (user_id);

CREATE TABLE IF NOT EXISTS device_installations (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_version text NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  revoked_at timestamptz,
  UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS membership_entitlements (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  stage text NOT NULL CHECK (stage IN ('trial_available', 'trial', 'free', 'premium')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  provider text CHECK (provider IN ('apple', 'wechat', 'alipay', 'channel')),
  product_id text,
  current_period_ends_at timestamptz,
  renewal_state text NOT NULL DEFAULT 'none'
    CHECK (renewal_state IN ('none', 'active', 'grace', 'cancelled', 'refunded')),
  updated_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_orders (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('apple', 'wechat', 'alipay', 'channel')),
  product_id text NOT NULL,
  amount_minor integer CHECK (amount_minor >= 0),
  currency char(3) NOT NULL DEFAULT 'CNY',
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'refunded', 'failed')),
  provider_order_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (provider, provider_order_id)
);

CREATE TABLE IF NOT EXISTS subscription_transactions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id text REFERENCES payment_orders(id) ON DELETE SET NULL,
  provider text NOT NULL CHECK (provider IN ('apple', 'wechat', 'alipay', 'channel')),
  provider_transaction_id text NOT NULL,
  original_transaction_id text,
  event_type text NOT NULL,
  effective_at timestamptz NOT NULL,
  expires_at timestamptz,
  payload_sha256 char(64) NOT NULL,
  received_at timestamptz NOT NULL,
  UNIQUE (provider, provider_transaction_id, event_type)
);

CREATE TABLE IF NOT EXISTS daily_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_key date NOT NULL,
  snapshot jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, day_key)
);

CREATE TABLE IF NOT EXISTS learning_events (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL,
  card_id char(6) NOT NULL,
  track text NOT NULL CHECK (track IN ('cet4', 'cet6')),
  phase text NOT NULL CHECK (phase IN ('learning', 'review')),
  interaction_id text NOT NULL,
  answer_grade text NOT NULL CHECK (answer_grade IN ('again', 'hard', 'good', 'easy')),
  used_hint boolean NOT NULL,
  used_peek boolean NOT NULL,
  device_id uuid NOT NULL,
  device_cursor bigint NOT NULL CHECK (device_cursor >= 0),
  client_timestamp timestamptz NOT NULL,
  server_received_at timestamptz NOT NULL,
  content_release_id text NOT NULL,
  payload_hash char(64) NOT NULL,
  PRIMARY KEY (user_id, event_id),
  UNIQUE (user_id, device_id, device_cursor)
);

CREATE INDEX IF NOT EXISTS learning_events_user_track_time_idx
  ON learning_events (user_id, track, client_timestamp DESC);

CREATE TABLE IF NOT EXISTS review_schedule_states (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id char(6) NOT NULL,
  track text NOT NULL CHECK (track IN ('cet4', 'cet6')),
  content_release_id text NOT NULL,
  due_at timestamptz NOT NULL,
  stability double precision NOT NULL CHECK (stability >= 0),
  difficulty double precision NOT NULL CHECK (difficulty >= 0),
  repetitions integer NOT NULL CHECK (repetitions >= 0),
  lapses integer NOT NULL CHECK (lapses >= 0),
  fsrs_version text NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS space_states (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_id char(6) NOT NULL,
  is_favorited boolean NOT NULL,
  is_sleeping boolean NOT NULL,
  last_modified_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS content_releases (
  id text PRIMARY KEY,
  track text NOT NULL CHECK (track IN ('cet4', 'cet6')),
  minimum_client_version text NOT NULL,
  parent_release_id text REFERENCES content_releases(id),
  manifest_sha256 char(64),
  signature text,
  signature_key_id text,
  approval_record_sha256 char(64),
  status text NOT NULL CHECK (status IN ('draft', 'active', 'retired')),
  activated_at timestamptz,
  CHECK (
    status <> 'active' OR (
      manifest_sha256 IS NOT NULL AND
      signature IS NOT NULL AND
      signature_key_id IS NOT NULL AND
      approval_record_sha256 IS NOT NULL AND
      activated_at IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS content_releases_one_active_per_track_idx
  ON content_releases (track) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS content_packs (
  id text PRIMARY KEY,
  release_id text NOT NULL REFERENCES content_releases(id) ON DELETE CASCADE,
  box_ref char(4) NOT NULL,
  asset_id text NOT NULL,
  sha256 char(64) NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  UNIQUE (release_id, box_ref)
);

CREATE TABLE IF NOT EXISTS account_deletion_jobs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  requested_at timestamptz NOT NULL,
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS audit_events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL
);
