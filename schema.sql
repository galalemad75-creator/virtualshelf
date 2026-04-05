-- VirtualShelf — Complete Database Schema
-- Run this in Supabase SQL Editor

-- Products table
CREATE TABLE IF NOT EXISTS vs_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  emoji TEXT DEFAULT '📦',
  stock INT DEFAULT 0,
  description TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS vs_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_name TEXT,
  customer_id UUID,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','preparing','ready','delivered','cancelled')),
  payment_method TEXT DEFAULT 'cash',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inventory log
CREATE TABLE IF NOT EXISTS vs_inventory_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES vs_products(id),
  action TEXT CHECK (action IN ('add','remove','adjust','receive')),
  quantity INT NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Low stock alerts
CREATE TABLE IF NOT EXISTS vs_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES vs_products(id),
  type TEXT DEFAULT 'low_stock',
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE vs_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE vs_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vs_inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vs_alerts ENABLE ROW LEVEL SECURITY;

-- Simple RLS policies (no recursion!)
CREATE POLICY "Products readable" ON vs_products FOR SELECT USING (true);
CREATE POLICY "Products writable" ON vs_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Products updatable" ON vs_products FOR UPDATE USING (true);
CREATE POLICY "Products deletable" ON vs_products FOR DELETE USING (true);

CREATE POLICY "Orders readable" ON vs_orders FOR SELECT USING (true);
CREATE POLICY "Orders writable" ON vs_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Orders updatable" ON vs_orders FOR UPDATE USING (true);

CREATE POLICY "Inventory readable" ON vs_inventory_log FOR SELECT USING (true);
CREATE POLICY "Inventory writable" ON vs_inventory_log FOR INSERT WITH CHECK (true);

CREATE POLICY "Alerts readable" ON vs_alerts FOR SELECT USING (true);
CREATE POLICY "Alerts writable" ON vs_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Alerts updatable" ON vs_alerts FOR UPDATE USING (true);

-- Realtime
ALTER TABLE vs_products REPLICA IDENTITY FULL;
ALTER TABLE vs_orders REPLICA IDENTITY FULL;
ALTER TABLE vs_inventory_log REPLICA IDENTITY FULL;
ALTER TABLE vs_alerts REPLICA IDENTITY FULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vs_products_cat ON vs_products(category);
CREATE INDEX IF NOT EXISTS idx_vs_products_stock ON vs_products(stock);
CREATE INDEX IF NOT EXISTS idx_vs_orders_status ON vs_orders(status);
CREATE INDEX IF NOT EXISTS idx_vs_orders_date ON vs_orders(created_at DESC);

-- Insert default products
INSERT INTO vs_products (name, name_ar, category, price, emoji, stock) VALUES
('Organic Whole Milk', 'حليب كامل عضوي', 'Dairy', 4.99, '🥛', 8),
('Sourdough Bread', 'خبز مخمر', 'Bakery', 3.49, '🍞', 3),
('Free Range Eggs', 'بيض حر', 'Dairy', 5.99, '🥚', 65),
('Sparkling Water', 'مياه غازية', 'Beverages', 1.99, '💧', 142),
('Avocados (3pk)', 'أفوكادو 3 حبات', 'Fruits', 6.99, '🥑', 7),
('Greek Yogurt', 'زبادي يوناني', 'Dairy', 4.49, '🫙', 34),
('Granola Mix', 'гранولا مكس', 'Grains', 7.99, '🥣', 52),
('Orange Juice', 'عصير برتقال', 'Beverages', 3.99, '🍊', 9),
('Potato Chips', 'شيبسي', 'Snacks', 2.49, '🥔', 88),
('Chocolate Bar', 'شوكولاتة', 'Snacks', 1.99, '🍫', 215),
('Butter', 'زبدة', 'Dairy', 5.49, '🧈', 41),
('Whole Wheat Pasta', 'معكرونة قمح كامل', 'Grains', 2.99, '🍝', 73)
ON CONFLICT DO NOTHING;

-- Insert sample orders
INSERT INTO vs_orders (order_number, customer_name, items, subtotal, total, status) VALUES
('VS-0048', 'Sara M.', '[{"name":"Organic Whole Milk","qty":2,"price":4.99},{"name":"Free Range Eggs","qty":1,"price":5.99}]', 15.97, 15.97, 'preparing'),
('VS-0047', 'Ahmed K.', '[{"name":"Sourdough Bread","qty":3,"price":3.49},{"name":"Butter","qty":1,"price":5.49}]', 15.96, 15.96, 'delivered'),
('VS-0046', 'Fatima L.', '[{"name":"Avocados (3pk)","qty":2,"price":6.99},{"name":"Greek Yogurt","qty":4,"price":4.49}]', 31.94, 31.94, 'preparing')
ON CONFLICT DO NOTHING;

-- Function to reduce stock when order is placed
CREATE OR REPLACE FUNCTION reduce_stock(product_name TEXT, qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE vs_products SET stock = GREATEST(0, stock - qty), updated_at = NOW() WHERE name = product_name;
  -- Create alert if stock is low
  INSERT INTO vs_alerts (product_id, type, message)
  SELECT id, 'low_stock', name || ' — ' || (stock - qty) || ' remaining'
  FROM vs_products WHERE name = product_name AND (stock - qty) < 10
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
