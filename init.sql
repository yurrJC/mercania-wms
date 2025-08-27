-- Mercania WMS Database Initialization
-- This script creates the initial database structure

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE item_status AS ENUM (
  'INTAKE',
  'STORED', 
  'LISTED',
  'RESERVED',
  'SOLD',
  'RETURNED',
  'DISCARDED'
);

CREATE TYPE listing_status AS ENUM (
  'ACTIVE',
  'SOLD',
  'EXPIRED',
  'REMOVED'
);

-- Create tables
CREATE TABLE IF NOT EXISTS isbn_master (
  id SERIAL PRIMARY KEY,
  isbn VARCHAR(13) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  author VARCHAR(200),
  publisher VARCHAR(200),
  pub_year INTEGER,
  binding VARCHAR(50),
  image_url TEXT,
  categories TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS items (
  id VARCHAR(26) PRIMARY KEY, -- ULID length
  isbn VARCHAR(13) REFERENCES isbn_master(isbn),
  condition_grade VARCHAR(10),
  condition_notes TEXT,
  cost_cents INTEGER DEFAULT 0,
  intake_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  current_status item_status DEFAULT 'INTAKE',
  current_location VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_status_history (
  id SERIAL PRIMARY KEY,
  item_id VARCHAR(26) REFERENCES items(id),
  from_status item_status,
  to_status item_status NOT NULL,
  channel VARCHAR(50),
  note TEXT,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listings (
  id SERIAL PRIMARY KEY,
  item_id VARCHAR(26) REFERENCES items(id),
  channel VARCHAR(50) NOT NULL,
  external_id VARCHAR(100),
  price_cents INTEGER NOT NULL,
  status listing_status DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(26) PRIMARY KEY, -- ULID length
  channel VARCHAR(50) NOT NULL,
  buyer VARCHAR(200),
  total_cents INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_lines (
  id SERIAL PRIMARY KEY,
  order_id VARCHAR(26) REFERENCES orders(id),
  item_id VARCHAR(26) REFERENCES items(id),
  qty INTEGER DEFAULT 1,
  sale_cents INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_items_isbn ON items(isbn);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(current_status);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(current_location);
CREATE INDEX IF NOT EXISTS idx_status_history_item ON item_status_history(item_id);
CREATE INDEX IF NOT EXISTS idx_listings_item ON listings(item_id);
CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_isbn_master_updated_at BEFORE UPDATE ON isbn_master
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_listings_updated_at BEFORE UPDATE ON listings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO isbn_master (isbn, title, author, publisher, pub_year, binding) VALUES
  ('9780140283334', 'The Great Gatsby', 'F. Scott Fitzgerald', 'Penguin Books', 1998, 'Paperback'),
  ('9780061120084', 'To Kill a Mockingbird', 'Harper Lee', 'Harper Perennial', 2006, 'Paperback')
ON CONFLICT (isbn) DO NOTHING;
