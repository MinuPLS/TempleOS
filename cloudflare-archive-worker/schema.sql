-- Apply this once to the existing Divine Manager D1 database before deployment.
-- All objects are additive; no existing table or index is modified.
CREATE TABLE IF NOT EXISTS archive_state (
  state_key TEXT PRIMARY KEY,
  state_value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS archive_events (
  resource TEXT NOT NULL,
  event_key TEXT NOT NULL,
  block_number TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  payload TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0,
  derived INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (resource, event_key)
);
CREATE INDEX IF NOT EXISTS archive_events_publishable
  ON archive_events(resource, published, timestamp_ms, event_key);
CREATE INDEX IF NOT EXISTS archive_events_derivable
  ON archive_events(resource, derived, timestamp_ms, event_key);

CREATE TABLE IF NOT EXISTS archive_chunks (
  resource TEXT NOT NULL,
  object_key TEXT PRIMARY KEY,
  from_block TEXT NOT NULL,
  through_block TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS archive_chunks_resource ON archive_chunks(resource, created_at);

CREATE TABLE IF NOT EXISTS manager_pools (
  pair_address TEXT PRIMARY KEY,
  token0_json TEXT NOT NULL,
  token1_json TEXT NOT NULL,
  execution_count INTEGER NOT NULL DEFAULT 0,
  reserve0 TEXT,
  reserve1 TEXT,
  reserve_timestamp INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS manager_pool_links (
  pair_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  PRIMARY KEY (pair_address, transaction_hash)
);

CREATE TABLE IF NOT EXISTS jit_hourly_snapshots (
  hour_ms INTEGER PRIMARY KEY,
  value TEXT NOT NULL
);

-- Raw Feeder transactions are retained separately from the rendered archive
-- records. This lets the hourly publisher group only the reorg overlap and
-- new activity, rather than ever re-fetching historical receipts.
CREATE TABLE IF NOT EXISTS feeder_transactions (
  tx_hash TEXT PRIMARY KEY NOT NULL,
  block_number TEXT NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS feeder_transactions_block
  ON feeder_transactions(block_number, timestamp_ms, tx_hash);
