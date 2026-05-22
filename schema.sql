-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id            SERIAL PRIMARY KEY,
  customer_name VARCHAR(100) NOT NULL,
  product_name  VARCHAR(100) NOT NULL,
  status        VARCHAR(20)  NOT NULL CHECK (status IN ('pending', 'shipped', 'delivered')),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Notify function: fires on any insert / update / delete
CREATE OR REPLACE FUNCTION notify_orders_change()
RETURNS TRIGGER AS $$
DECLARE
  payload JSON;
BEGIN
  IF TG_OP = 'DELETE' THEN
    payload = json_build_object(
      'op',   TG_OP,
      'data', row_to_json(OLD)
    );
  ELSE
    payload = json_build_object(
      'op',   TG_OP,
      'data', row_to_json(NEW)
    );
  END IF;

  PERFORM pg_notify('orders_channel', payload::TEXT);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS orders_change_trigger ON orders;
CREATE TRIGGER orders_change_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION notify_orders_change();

-- Seed data
INSERT INTO orders (customer_name, product_name, status) VALUES
  ('Aryan Kumar',  'Wireless Mouse',  'pending'),
  ('Sara Ahmed',   'Mechanical Keyboard', 'shipped'),
  ('Jay Kim',      'USB-C Hub',       'delivered');
