-- ═══════════════════════════════════════════════════════════════
-- LOOT 95 — Production PostgreSQL Schema for Supabase / Cloud Postgres
-- Full DDL for Products, Price History, Deal Events, Scores & Metrics
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(255) PRIMARY KEY,
    brand VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    title TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    platform_product_id VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    image_url TEXT,
    mrp NUMERIC(12, 2) NOT NULL,
    current_price NUMERIC(12, 2) NOT NULL,
    effective_price NUMERIC(12, 2) NOT NULL,
    seller_name VARCHAR(255),
    seller_rating NUMERIC(3, 2),
    stock_status VARCHAR(50) DEFAULT 'in_stock',
    rating NUMERIC(3, 2) DEFAULT 4.0,
    review_count INT DEFAULT 0,
    coupon_required BOOLEAN DEFAULT FALSE,
    bank_offer_required BOOLEAN DEFAULT FALSE,
    specifications JSONB DEFAULT '{}'::jsonb,
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price History Table (Optimized for time-series queries)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL,
    effective_price NUMERIC(12, 2) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_time ON price_history (product_id, timestamp DESC);

-- Price Statistics Table
CREATE TABLE IF NOT EXISTS price_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    period VARCHAR(10) NOT NULL, -- 7d, 30d, 90d, 180d, 365d
    median NUMERIC(12, 2) NOT NULL,
    mean NUMERIC(12, 2) NOT NULL,
    min NUMERIC(12, 2) NOT NULL,
    max NUMERIC(12, 2) NOT NULL,
    p5 NUMERIC(12, 2),
    p25 NUMERIC(12, 2),
    p75 NUMERIC(12, 2),
    p95 NUMERIC(12, 2),
    stddev NUMERIC(12, 2),
    sample_count INT NOT NULL,
    extreme_discount_count INT DEFAULT 0,
    last_extreme_discount_at TIMESTAMPTZ,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, period)
);

-- Deal Events Table
CREATE TABLE IF NOT EXISTS deal_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id VARCHAR(255) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    classification VARCHAR(50) NOT NULL, -- NORMAL, GREAT, HOT, EXTREME, LOOT_95, PRICE_ERROR
    loot_score NUMERIC(5, 2) NOT NULL,
    rarity_score NUMERIC(5, 2) NOT NULL,
    score_components JSONB NOT NULL,
    confidence NUMERIC(3, 2) NOT NULL,
    confidence_reason TEXT,
    current_price NUMERIC(12, 2) NOT NULL,
    normal_price NUMERIC(12, 2) NOT NULL,
    historical_median NUMERIC(12, 2) NOT NULL,
    historical_low NUMERIC(12, 2) NOT NULL,
    real_discount_pct INT NOT NULL,
    displayed_discount_pct INT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    detection_latency_ms INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    ai_verdict VARCHAR(50),
    ai_reasoning TEXT,
    ai_checks JSONB,
    explanations JSONB DEFAULT '[]'::jsonb,
    is_sleeping_product BOOLEAN DEFAULT FALSE,
    is_never_seen_before BOOLEAN DEFAULT FALSE,
    price_error_probability NUMERIC(5, 2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_events_classification ON deal_events (classification, is_active, loot_score DESC);
CREATE INDEX IF NOT EXISTS idx_deal_events_detected_at ON deal_events (detected_at DESC);

-- Alerts Table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_event_id UUID NOT NULL REFERENCES deal_events(id) ON DELETE CASCADE,
    priority VARCHAR(20) NOT NULL, -- CRITICAL, HIGH, NORMAL
    channel VARCHAR(20) NOT NULL,  -- web, email, push
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
