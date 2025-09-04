-- Add performance indexes for better query performance
-- These indexes will significantly improve query speed as the database grows

-- Index for dashboard statistics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_status_performance 
ON items("currentStatus") 
WHERE "currentStatus" IS NOT NULL;

-- Composite index for status and cost queries (COGS calculations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_status_cost 
ON items("currentStatus", "costCents") 
WHERE "currentStatus" = 'SOLD';

-- Index for lot number queries (already exists but ensuring it's optimized)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_lot_number 
ON items("lotNumber") 
WHERE "lotNumber" IS NOT NULL;

-- Index for created_at queries (for lot ordering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_created_at 
ON items("createdAt");

-- Composite index for lot queries with ordering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_lot_created 
ON items("lotNumber", "createdAt") 
WHERE "lotNumber" IS NOT NULL;

-- Index for ISBN/barcode searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_items_isbn_search 
ON items(isbn) 
WHERE isbn IS NOT NULL;

-- Index for title searches (if needed in the future)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_isbn_master_title 
ON isbn_master(title) 
WHERE title IS NOT NULL;

-- Analyze tables to update statistics
ANALYZE items;
ANALYZE isbn_master;
