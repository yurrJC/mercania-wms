-- Performance Indexes for Mercania WMS
-- Run these in your PostgreSQL database for optimal performance

-- Index for lot number filtering (most important for your use case)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_lot_number 
ON items(lot_number) 
WHERE lot_number IS NOT NULL;

-- Composite index for lot + status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_lot_status 
ON items(lot_number, current_status) 
WHERE lot_number IS NOT NULL;

-- Index for status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_status 
ON items(current_status);

-- Index for location filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_location 
ON items(current_location) 
WHERE current_location IS NOT NULL;

-- Index for ISBN lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_isbn 
ON items(isbn);

-- Index for intake date (useful for sorting)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_intake_date 
ON items(intake_date);

-- Composite index for pagination with lot grouping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_lot_id_desc 
ON items(lot_number ASC, id DESC);

-- Index for general item search and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_id_desc 
ON items(id DESC);

-- Analyze tables after creating indexes
ANALYZE items;
ANALYZE isbn_masters;

-- Show index usage (run after some queries)
-- SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch 
-- FROM pg_stat_user_indexes 
-- WHERE tablename = 'items' 
-- ORDER BY idx_tup_read DESC;
