-- Migration 003: Product Catalog for v0.2
-- Create product catalog and signal tracking tables

-- ============================================================================
-- Product Catalog (for deal matching)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_catalog (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Product info
    title TEXT NOT NULL,
    description TEXT,
    keywords TEXT[],
    
    -- Full-text search vector (auto-generated)
    search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', title || ' ' || COALESCE(description, ''))
    ) STORED,
    
    -- Categorization
    category TEXT NOT NULL,
    merchant TEXT NOT NULL,
    
    -- Affiliate info
    affiliate_url TEXT NOT NULL,
    commission_rate FLOAT DEFAULT 0.05,
    
    -- Pricing
    price FLOAT,
    original_price FLOAT,
    discount TEXT,
    
    -- Media
    image_url TEXT,
    
    -- Status
    active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_product_category ON product_catalog(category);
CREATE INDEX IF NOT EXISTS idx_product_active ON product_catalog(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_search ON product_catalog USING GIN(search_vector);

-- ============================================================================
-- User Signals (telemetry for v0.2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_signals (
    signal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User identification (anonymous)
    anonymous_id TEXT NOT NULL,
    
    -- Signal data (aggregate, not specific pages)
    categories TEXT[],          -- Categories user is interested in
    entity_count INTEGER,       -- Number of keywords sent
    
    -- Points awarded
    points_awarded INTEGER DEFAULT 10,
    
    -- Matching results
    deals_matched INTEGER DEFAULT 0,
    
    -- Timestamp
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_signal_anonymous_id ON user_signals(anonymous_id);
CREATE INDEX IF NOT EXISTS idx_signal_timestamp ON user_signals(timestamp);

-- ============================================================================
-- Update points_ledger for new transaction types (v0.2)
-- ============================================================================

-- Add transaction_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'points_ledger' AND column_name = 'transaction_type'
    ) THEN
        ALTER TABLE points_ledger ADD COLUMN transaction_type TEXT DEFAULT 'purchase';
    END IF;
END $$;

-- Update any NULL transaction types
UPDATE points_ledger SET transaction_type = 'purchase' WHERE transaction_type IS NULL;

-- ============================================================================
-- Signal History Cleanup Function
-- ============================================================================

-- Function to clean up old signals (90-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_signals()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_signals WHERE timestamp < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Sample Seed Data (for testing)
-- ============================================================================

-- Insert sample products (electronics category)
INSERT INTO product_catalog (title, description, keywords, category, merchant, affiliate_url, commission_rate, price, original_price, discount, image_url, active)
VALUES
    (
        'Sony WH-1000XM5 Wireless Headphones',
        'Industry-leading noise cancellation with exceptional sound quality. Premium comfort for all-day wear.',
        ARRAY['headphones', 'noise cancelling', 'sony', 'wireless', 'bluetooth', 'audio'],
        'electronics',
        'Amazon',
        'https://amazon.com/dp/B09XS7JWHH?tag=datapay-20',
        0.05,
        348.00,
        399.99,
        '13% off',
        'https://m.media-amazon.com/images/I/51K0kOPmF9L._AC_SL1500_.jpg',
        TRUE
    ),
    (
        'Apple AirPods Pro (2nd Generation)',
        'Active Noise Cancellation and Adaptive Transparency. Personalized Spatial Audio with dynamic head tracking.',
        ARRAY['airpods', 'apple', 'earbuds', 'wireless', 'noise cancelling', 'bluetooth'],
        'electronics',
        'Apple',
        'https://apple.com/airpods-pro?afid=datapay',
        0.03,
        249.00,
        249.00,
        'Free shipping',
        'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/MQD83',
        TRUE
    )
ON CONFLICT DO NOTHING;

-- Insert sample products (fitness category)
INSERT INTO product_catalog (title, description, keywords, category, merchant, affiliate_url, commission_rate, price, original_price, discount, image_url, active)
VALUES
    (
        'Nike Pegasus 40 Running Shoes',
        'Responsive cushioning in the Pegasus provides a smooth ride for any run. Experience lighter-weight energy return.',
        ARRAY['running shoes', 'nike', 'sneakers', 'athletics', 'sports'],
        'fitness',
        'Nike',
        'https://nike.com/t/pegasus-40?cp=datapay',
        0.08,
        130.00,
        140.00,
        '$10 off',
        'https://static.nike.com/a/images/t_PDP_1728_v1/pegasus-40',
        TRUE
    ),
    (
        'Fitbit Charge 6 Fitness Tracker',
        'All-day activity tracking with built-in GPS. Heart rate monitoring and sleep tracking.',
        ARRAY['fitbit', 'fitness tracker', 'health', 'wearable', 'smartwatch'],
        'fitness',
        'Fitbit',
        'https://fitbit.com/charge6?aid=datapay',
        0.06,
        159.95,
        179.95,
        '$20 off',
        'https://www.fitbit.com/global/content/dam/fitbit/global/pdp/charge6',
        TRUE
    )
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verify Installation
-- ============================================================================

-- Show product count
SELECT 
    category,
    COUNT(*) as product_count,
    AVG(commission_rate) as avg_commission
FROM product_catalog
WHERE active = TRUE
GROUP BY category
ORDER BY category;

