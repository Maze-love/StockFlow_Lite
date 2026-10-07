-- Enable UUID extension (if uuid generation on database layer is preferred)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Custom Enum Types
CREATE TYPE user_role AS ENUM ('org_admin', 'staff', 'viewer');
CREATE TYPE movement_type AS ENUM ('STOCK_IN', 'RESERVATION', 'RESERVATION_RELEASE', 'ADJUSTMENT', 'FULFILLMENT');
CREATE TYPE order_status AS ENUM ('DRAFT', 'RESERVED', 'CONFIRMED', 'FULFILLED', 'CANCELLED', 'RESERVATION_EXPIRED');

-- -----------------------------------------------------------------------------
-- 1. USERS
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 2. ORGANIZATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 3. ORGANIZATION MEMBERS (Many-to-Many mapping with Roles)
-- -----------------------------------------------------------------------------
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_user UNIQUE (organization_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 4. PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_sku UNIQUE (organization_id, sku)
);

-- -----------------------------------------------------------------------------
-- 5. WAREHOUSES
-- -----------------------------------------------------------------------------
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 6. CUSTOMERS
-- -----------------------------------------------------------------------------
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_customer_email UNIQUE (organization_id, email)
);

-- -----------------------------------------------------------------------------
-- 7. INVENTORY (Optimistic locking versioning + Stock integrity checks)
-- -----------------------------------------------------------------------------
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_on_hand INT NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
    quantity_reserved INT NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_warehouse_product UNIQUE (warehouse_id, product_id),
    CONSTRAINT chk_reserved_le_on_hand CHECK (quantity_reserved <= quantity_on_hand)
);

-- -----------------------------------------------------------------------------
-- 8. INVENTORY MOVEMENTS (Audit trail for stock shifts)
-- -----------------------------------------------------------------------------
CREATE TABLE inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type movement_type NOT NULL,
    quantity INT NOT NULL,
    reference_id UUID, -- Stores order_id or transfer reference id
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- 9. ORDERS (State machine + Idempotency support)
-- -----------------------------------------------------------------------------
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    status order_status NOT NULL DEFAULT 'DRAFT',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total >= 0),
    reservation_expires_at TIMESTAMP WITH TIME ZONE,
    idempotency_key VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_org_idempotency_key UNIQUE (organization_id, idempotency_key)
);

-- -----------------------------------------------------------------------------
-- 10. ORDER ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
);

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR TENANT ISOLATION & PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_warehouses_org ON warehouses(organization_id);
CREATE INDEX idx_customers_org ON customers(organization_id);

CREATE INDEX idx_inventory_org ON inventory(organization_id);
CREATE INDEX idx_inventory_wh_prod ON inventory(warehouse_id, product_id);

CREATE INDEX idx_inventory_movements_org ON inventory_movements(organization_id);
CREATE INDEX idx_orders_org ON orders(organization_id);
CREATE INDEX idx_orders_status_expires ON orders(status, reservation_expires_at) WHERE status = 'RESERVED';

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_audit_logs_org_actor ON audit_logs(organization_id, actor_id);