# StockFlow Lite API

StockFlow Lite is a secure, multi-tenant inventory management and order fulfillment backend system designed to let multiple organizations manage their own warehouses, products, stock levels, and customer orders independently without data leaks.

## Main Features

- Authentication and authorization support
- Multi-tenant organization boundaries
- Product and warehouse management
- Inventory tracking and reservation logic
- Order fulfillment and reservation expiry handling
- Audit log tracking
- Health monitoring endpoint
- Rate limiting and security middleware

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- pg (PostgreSQL client)
- JWT for authentication
- Helmet, CORS, and rate limiting middleware

## Project Structure

```text
.
├── app.js                 # App setup and route registration
├── server.js              # Starts the server and background jobs
├── config/
│   └── db.js              # PostgreSQL connection config
├── database/
│   └── migrate.js         # Database migration script
├── jobs/
│   └── expireReservations.js
│                          # Background job to expire reservation orders
├── middleware/
│   ├── errorHandler.js
│   └── rateLimiter.js
├── modules/
│   ├── auth/
│   ├── organizations/
│   ├── products/
│   ├── warehouses/
│   ├── customers/
│   ├── inventory/
│   ├── orders/
│   └── audit/
├── .env                   # Local environment configuration
├── package.json
├── package-lock.json
└── node_modules/
```

---

## 🏗️ Architecture Summary

The application follows a modular MVC + service-layer architecture using pure Node.js and Express.js (ES Modules) without an ORM:

- **Database Access**: Direct PostgreSQL interaction via the `pg` package using parameterized queries for protection against SQL injection.

- **Multi-Tenancy**: Tenant scoping (`organization_id`) enforced across all database tables and queries, ensuring cross-tenant attempts return a secure `404 Not Found` rather than a `403 Forbidden`.

- **Security**: Protected with `bcrypt` password hashing, JSON Web Tokens (`jsonwebtoken`), `helmet` security headers, `cors`, and custom IP rate limiting (`express-rate-limit`).

- **Concurrency Control**: Implements row-level locking (`SELECT FOR UPDATE`) inside atomic SQL transactions to prevent race conditions and overselling.

---

## ⚙️ Local Setup Instructions

### Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL installed and running locally

### 1. Clone & Install Dependencies

```bash
git clone <your-repository-url>
cd stockflow-lite
npm install

```

### 2. Configure Environment Variables

Create a `.env` file in the root directory based on the example below:

#### `.env.example`

```env
PORT=3000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=postgres
DATABASE_PASSWORD=your_postgres_password
DATABASE_DATABASE=stockflow_db
JWT_SECRET=your_jwt_secret_key_here

```

### 3. Create the Database

Open your terminal or database client and create the target PostgreSQL database:

```bash
createdb -U postgres stockflow_db

```

### 4. Run Database Migrations

Execute the migration script to build all 11 relational tables, constraints, and custom ENUM types:

```bash
npm run migrate

```

### 5. Start the Application

```bash
npm start

```

The server will run on `http://localhost:PORT` and automatically spin up the background reservation-expiry timer job.

---

## 🔌 API Documentation & Modules

All endpoints are versioned under `/api/v1` and grouped into modular folders:

- **Auth**: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/auth/me`

- **Organizations & Members**: `POST /api/v1/organizations`, `POST /api/v1/organizations/:organizationId/members` (Supports 3 roles: `org_admin`, `staff`, `viewer`)

- **Products**: Full CRUD with support for pagination, search by name, filtering, and sorting

- **Warehouses**: Manage multi-facility inventory hubs

- **Inventory**: Stock-in operations and atomic transactional warehouse transfers

- **Customers**: Organization-scoped customer registry

- **Orders**: Complete order state machine (`DRAFT` -0> `RESERVED`--> `CONFIRMED` --> `FULFILLED`, alongside `CANCELLED` and `RESERVATION_EXPIRED`), protected by an `Idempotency-Key` header

- **Audit Logs**: Filterable actor and resource activity tracking

---

## 🔒 Concurrency Strategy Explanation

To resolve concurrent race conditions (e.g., two users trying to reserve the last remaining stock items at the exact same instant), **Row-Level Locking (`SELECT FOR UPDATE`)** was implemented inside SQL transactions:

1. When a reservation request arrives, the application opens a transaction and locks the specific target inventory row using `SELECT ... FOR UPDATE`.

2. Available quantity is evaluated safely while other competing requests wait for the lock to release.

3. If stock is available, it decrements or increments correctly and commits; otherwise, it throws an `INSUFFICIENT_INVENTORY` error or rolls back.

---

## Background Job: Reservation Expiry

The server automatically starts the reservation expiry job when it boots. This job runs every 60 seconds and:

- Finds orders with status `RESERVED` whose reservation expiration time has passed
- Releases reserved stock back into inventory
- Records inventory movement entries
- Marks the order as `RESERVATION_EXPIRED`
- Creates an audit log entry

This logic is implemented in:

- `jobs/expireReservations.js`

## 📝 Known Limitations & Scope Decisions

As part of the design scope for an accelerated single-process learning project, several enterprise features were deliberately omitted:

- **Background Queue vs. In-Process Timer**: Reservation expiry relies on a light in-process JavaScript `setInterval` function running every 60 seconds rather than a distributed message broker like Redis or BullMQ. This is safe for single-instance setups but would require a shared queue system (like Redis) if scaled horizontally across multiple server instances.

- **Automated Test Suites**: Automated testing frameworks (Jest/Supertest) were omitted in favor of structured, repeatable manual validation through Postman collections.

## License

This project is licensed under the ISC license.
