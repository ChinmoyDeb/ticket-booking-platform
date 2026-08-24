# 🎫 TicketHub — Ticket Booking Platform

A production-ready full-stack ticket booking platform for movies and concerts with real-time seat selection, hold TTL, distributed concurrency control, automated waitlist management, and QR code email tickets.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+

### 1. Clone & Install

```bash
# Backend
cd backend
npm install
cp .env.example .env
# → Fill in your values (see Environment Variables section)

# Frontend
cd ../frontend
npm install
cp .env.example .env
```

### 2. Setup Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ticket_booking;"

# Run schema migration
cd backend
npm run migrate

# Seed demo data (admin, organizer, customer, venue, event)
npm run seed
```

### 3. Start Redis

```bash
# Docker (recommended):
docker run -d -p 6379:6379 redis:7-alpine

# Or if Redis is installed locally:
redis-server
```

### 4. Start the Application

```bash
# Terminal 1: Backend
cd backend
npm run dev     # starts on http://localhost:5000

# Terminal 2: Frontend
cd frontend
npm run dev     # starts on http://localhost:5173
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@tickethub.com | Admin@12345 |
| Organizer | organizer@tickethub.com | Organizer@123 |
| Customer | customer@tickethub.com | Customer@123 |

---

## 📁 Project Structure

```
ticket-booking-platform/
├── backend/
│   ├── migrations/
│   │   └── 001_schema.sql        # Complete PostgreSQL schema
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js             # pg-promise pool
│   │   │   └── redis.js          # ioredis client
│   │   ├── middleware/
│   │   │   ├── auth.js           # JWT + role middleware
│   │   │   └── errorHandler.js   # Centralized errors
│   │   ├── routes/
│   │   │   ├── auth.js           # Register, login, reset
│   │   │   ├── bookings.js       # Hold, book, cancel, QR verify
│   │   │   ├── events.js         # CRUD, seat map, revenue
│   │   │   ├── venues.js         # Admin venue management
│   │   │   └── waitlist.js       # Join, offer, accept, decline
│   │   ├── scripts/
│   │   │   ├── migrate.js        # DB migration runner
│   │   │   └── seed.js           # Demo data seeder
│   │   ├── services/
│   │   │   ├── emailService.js   # Nodemailer + Gmail SMTP
│   │   │   ├── qrService.js      # QR generation + verification
│   │   │   ├── scheduler.js      # node-cron jobs
│   │   │   ├── seatHoldService.js# Distributed lock + hold TTL
│   │   │   └── waitlistService.js# Waitlist queue management
│   │   ├── templates/
│   │   │   ├── booking-confirmation.html
│   │   │   ├── cancellation.html
│   │   │   ├── password-reset.html
│   │   │   └── waitlist-offer.html
│   │   └── server.js             # Express entry point
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── EventCard.jsx
    │   │   ├── Navbar.jsx
    │   │   ├── SeatMap.jsx       # Real-time seat grid
    │   │   └── Toast.jsx
    │   ├── pages/
    │   │   ├── HomePage.jsx
    │   │   ├── EventDetailPage.jsx
    │   │   ├── CheckoutPage.jsx
    │   │   ├── LoginPage.jsx
    │   │   ├── RegisterPage.jsx
    │   │   ├── BookingHistoryPage.jsx
    │   │   ├── BookingDetailPage.jsx
    │   │   ├── OrganizerDashboard.jsx
    │   │   ├── RevenueReportPage.jsx
    │   │   ├── AdminVenuesPage.jsx
    │   │   └── WaitlistActionPage.jsx
    │   ├── services/api.js       # Axios client
    │   ├── stores/
    │   │   ├── authStore.js      # Zustand auth store
    │   │   └── bookingStore.js   # Zustand booking store
    │   ├── App.jsx               # Routes
    │   └── index.css             # Design system
    └── package.json
```

---

## 🌍 Environment Variables

### Backend (`backend/.env`)

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:5173

DATABASE_URL=postgresql://postgres:password@localhost:5432/ticket_booking
REDIS_URL=redis://localhost:6379

JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=7d

SEAT_HOLD_TTL_MINUTES=10
WAITLIST_OFFER_TTL_MINUTES=15

QR_CODE_SECRET=your_qr_hmac_secret_change_in_production

# Gmail SMTP — see setup guide below
GMAIL_USER=your_gmail@gmail.com
GMAIL_APP_PASSWORD=your_16_char_app_password
EMAIL_FROM_NAME=TicketHub

ADMIN_EMAIL=admin@tickethub.com
ADMIN_PASSWORD=Admin@12345
```

### Gmail App Password Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Go to: Google Account → Security → App Passwords
3. Select app: **Mail**, device: **Other (custom name)** → "TicketHub"
4. Copy the 16-character password into `GMAIL_APP_PASSWORD`

---

## 📡 API Documentation

### Base URL: `http://localhost:5000/api`

All authenticated endpoints require: `Authorization: Bearer <jwt_token>`

#### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register (role: customer / organizer) |
| POST | `/auth/login` | — | Login → returns JWT |
| GET | `/auth/me` | ✓ | Get current user profile |
| PUT | `/auth/me` | ✓ | Update profile |
| POST | `/auth/forgot-password` | — | Send reset email |
| POST | `/auth/reset-password` | — | Reset password with token |

#### Venues (Admin only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/venues` | List all venues |
| GET | `/venues/:id` | Get venue with categories |
| POST | `/venues` | Create venue with seat categories |
| PUT | `/venues/:id` | Update venue |
| DELETE | `/venues/:id` | Delete venue |

#### Events
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/events` | — | List events (paginated, filterable) |
| GET | `/events/:id` | — | Get event with pricing |
| GET | `/events/:id/seat-map` | — | Real-time seat status |
| POST | `/events` | Organizer | Create event |
| PATCH | `/events/:id/publish` | Organizer | Publish draft event |
| PUT | `/events/:id` | Organizer | Update event |
| DELETE | `/events/:id` | Organizer | Cancel event |
| GET | `/events/:id/bookings` | Organizer | Booking summary |
| GET | `/events/:id/revenue` | Organizer | Revenue by category |

#### Bookings
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/bookings/events/:eventId/seats/hold` | Customer | Hold seats (10-min TTL) |
| DELETE | `/bookings/events/:eventId/seats/:seatId/hold` | Customer | Release a hold |
| POST | `/bookings` | Customer | Confirm booking |
| GET | `/bookings/customer/all` | Customer | Booking history |
| GET | `/bookings/:id` | Customer | Single booking |
| PUT | `/bookings/:id/cancel` | Customer | Cancel booking |
| POST | `/bookings/verify-qr` | — | Verify QR at venue |

#### Waitlist
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/waitlist/events/:eventId/join` | Customer | Join waitlist |
| GET | `/waitlist/events/:eventId` | Customer | My waitlist status |
| DELETE | `/waitlist/events/:eventId` | Customer | Leave waitlist |
| GET | `/waitlist/pending-offers` | Customer | Active seat offers |
| POST | `/waitlist/accept?token=xxx` | Customer | Accept offered seat |
| POST | `/waitlist/decline?token=xxx` | Customer | Decline offered seat |

---

## 🗄️ Database Schema

```
users            → id, email, password_hash, role, first_name, last_name, phone
venues           → id, name, city, address, description, total_seats
seat_categories  → id, venue_id, category_name, base_price, quantity
events           → id, organizer_id, venue_id, title, event_type, event_date, event_time, status
event_pricing    → id, event_id, category_id, price
seat_layout      → id, venue_id, event_id, row_number, seat_number, category_id, status
seat_holds       → id, event_id, seat_id, customer_id, hold_expires_at
bookings         → id, event_id, customer_id, booking_reference, total_amount, status
booking_seats    → id, booking_id, seat_id, price
waitlists        → id, event_id, customer_id, category_id, position, status, offer_token, offer_expires_at
booking_history  → id, booking_id, action, details, created_by
```

---

## ⚙️ System Design

### Seat Hold & TTL Mechanism

When a customer selects seats, the system:

1. **Acquires a Redis distributed lock** (`SET lock:{eventId}:{seatId} {uuid} NX EX 30`) — atomic, prevents two concurrent requests
2. **Begins a PostgreSQL transaction** with `SELECT ... FOR UPDATE` row-level lock on the seat
3. **Verifies** `status = 'available'` inside the lock
4. **Updates** `seat_layout.status = 'held'`
5. **Inserts** into `seat_holds` with `hold_expires_at = NOW() + 10 minutes`
6. **Sets Redis key** `hold:{eventId}:{seatId}` with the same 10-minute TTL
7. **Releases** the distributed lock

A `node-cron` job runs every 60 seconds and:
- Queries `seat_holds WHERE hold_expires_at < NOW()`
- For each expired hold: deletes the Redis key, deletes the DB record, resets `seat_layout.status = 'available'`

### Concurrency Prevention

Two simultaneous requests for the same seat cannot both succeed because:
- Redis `SET NX` is atomic — only one thread wins the lock
- The loser receives a `409 Conflict` immediately
- Even if Redis fails, the `SELECT FOR UPDATE` row-level lock in PostgreSQL provides a second layer of protection

### Waitlist Auto-Assignment Flow

```
Booking Cancelled
       │
       ▼
seat_layout.status = 'available'
       │
       ▼
Query: first 'waiting' entry for (event_id, category_id)
       │
  Found? ──→ No → seat stays 'available'
       │
      Yes
       │
       ▼
UPDATE waitlists SET status='offered', offer_token=random(32B),
       offer_expires_at = NOW() + 15min
UPDATE seat_layout SET status='held'  (reserved for this customer)
Send "Your seat is ready!" email with Accept/Decline links
```

### Time-Limited Offer Handling

- `node-cron` runs every 60 seconds
- Queries `waitlists WHERE status='offered' AND offer_expires_at < NOW()`
- For each expired offer:
  1. `UPDATE status='expired'`
  2. `UPDATE seat_layout SET status='available'`
  3. Recompact queue positions
  4. Recursively offer to the next waiting customer

If a customer accepts:
- `POST /waitlist/accept?token=xxx` (from email link)
- Token verified, booking created atomically, seat set to 'booked'
- Email sent with QR code

---

## 🚢 Deployment (Render + Supabase + Upstash)

### 1. Database — Supabase (free)
1. Create project at [supabase.com](https://supabase.com)
2. Copy the **Connection String** (PostgreSQL URI)
3. Run migration: `DATABASE_URL=<supabase_url> npm run migrate`

### 2. Redis — Upstash (free)
1. Create Redis database at [upstash.com](https://upstash.com)
2. Copy the **Redis URL** (starts with `rediss://`)

### 3. Backend — Render (free)
1. New Web Service → connect GitHub repo
2. Root: `backend/`, Build: `npm install`, Start: `node src/server.js`
3. Add all environment variables from `.env.example`

### 4. Frontend — Render Static Site (or Vercel)
1. Root: `frontend/`, Build: `npm run build`, Publish: `dist/`
2. Set `VITE_API_URL=https://your-backend.onrender.com/api`

---

## 🔒 Security

- Passwords hashed with bcrypt (10 rounds)
- JWT tokens expire in 7 days
- Rate limiting on login (10 attempts / 15 min)
- QR codes signed with HMAC-SHA256 to prevent forgery
- Role-based access control on all protected routes
- SQL injection prevented by parameterized queries (pg-promise)
