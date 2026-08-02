CREATE TABLE IF NOT EXISTS executions (
  tx_hash TEXT PRIMARY KEY NOT NULL,
  block_number INTEGER NOT NULL,
  transaction_index INTEGER NOT NULL,
  timestamp_ms INTEGER NOT NULL,
  manager_address TEXT NOT NULL,
  payload TEXT NOT NULL,
  indexed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS executions_feed_order
  ON executions (block_number DESC, transaction_index DESC, tx_hash DESC);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  initial_cursor TEXT,
  last_block INTEGER,
  historical_complete INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
