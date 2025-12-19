-- Migration 001: Initial Schema
-- Base tables for DataPay Assist

-- ============================================================================
-- Users Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_id TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_seen TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_anonymous_id ON users(anonymous_id);

-- ============================================================================
-- Points Ledger
-- ============================================================================
CREATE TABLE IF NOT EXISTS points_ledger (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    description TEXT,
    transaction_type TEXT DEFAULT 'purchase',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_points_created ON points_ledger(created_at);

-- ============================================================================
-- Points Balance View
-- ============================================================================
CREATE OR REPLACE VIEW user_points_balance AS
SELECT 
    user_id,
    SUM(points) as total_points,
    SUM(CASE WHEN transaction_type = 'signal' THEN points ELSE 0 END) as signals_points,
    SUM(CASE WHEN transaction_type = 'click' THEN points ELSE 0 END) as clicks_points,
    SUM(CASE WHEN transaction_type = 'purchase' THEN points ELSE 0 END) as purchases_points,
    SUM(CASE WHEN transaction_type = 'bonus' THEN points ELSE 0 END) as bonuses_points
FROM points_ledger
GROUP BY user_id;

-- ============================================================================
-- Verify Installation
-- ============================================================================
SELECT 'Schema initialized successfully' as status;

