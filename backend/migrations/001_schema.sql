-- =============================================================================
-- Ticket Booking Platform — PostgreSQL Schema
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE user_role AS ENUM ('customer', 'organizer', 'admin');
CREATE TYPE seat_status AS ENUM ('available', 'held', 'booked', 'blocked');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled', 'refunded');
CREATE TYPE waitlist_status AS ENUM ('waiting', 'offered', 'completed', 'expired', 'cancelled');

-- ─────────────────────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(320) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  role          user_role NOT NULL DEFAULT 'customer',
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  phone         VARCHAR(20),
  reset_token       VARCHAR(64),
  reset_token_expiry TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ─────────────────────────────────────────────────────────────────────────────
-- VENUES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE venues (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(255) NOT NULL,
  city        VARCHAR(100) NOT NULL,
  address     TEXT,
  description TEXT,
  total_seats INT NOT NULL DEFAULT 0 CHECK (total_seats >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_city ON venues(city);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEAT CATEGORIES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE seat_categories (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id      UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  category_name VARCHAR(100) NOT NULL,
  base_price    DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (base_price >= 0),
  quantity      INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, category_name)
);

CREATE INDEX idx_seat_categories_venue ON seat_categories(venue_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID NOT NULL REFERENCES users(id),
  venue_id     UUID NOT NULL REFERENCES venues(id),
  title        VARCHAR(255) NOT NULL,
  description  TEXT,
  event_type   VARCHAR(50) NOT NULL DEFAULT 'concert', -- movie | concert | sports
  event_date   DATE NOT NULL,
  event_time   TIME NOT NULL,
  status       event_status NOT NULL DEFAULT 'draft',
  image_url    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_organizer  ON events(organizer_id);
CREATE INDEX idx_events_venue      ON events(venue_id);
CREATE INDEX idx_events_date       ON events(event_date);
CREATE INDEX idx_events_status     ON events(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- EVENT PRICING (price per category per event)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE event_pricing (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES seat_categories(id),
  price       DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, category_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- SEAT LAYOUT (per-seat status per event)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE seat_layout (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venue_id    UUID NOT NULL REFERENCES venues(id),
  event_id    UUID REFERENCES events(id) ON DELETE CASCADE,
  row_number  INT NOT NULL CHECK (row_number > 0),
  seat_number INT NOT NULL CHECK (seat_number > 0),
  category_id UUID NOT NULL REFERENCES seat_categories(id),
  status      seat_status NOT NULL DEFAULT 'available',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, row_number, seat_number)
);

CREATE INDEX idx_seat_layout_event    ON seat_layout(event_id);
CREATE INDEX idx_seat_layout_venue    ON seat_layout(venue_id);
CREATE INDEX idx_seat_layout_status   ON seat_layout(status);
CREATE INDEX idx_seat_layout_category ON seat_layout(category_id);

-- Partial unique index for venue template seats (event_id IS NULL)
-- Prevents duplicate venue seats when seed is re-run
CREATE UNIQUE INDEX idx_seat_layout_venue_template
  ON seat_layout (venue_id, row_number, seat_number)
  WHERE event_id IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- SEAT HOLDS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE seat_holds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seat_id         UUID NOT NULL REFERENCES seat_layout(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES users(id),
  hold_expires_at TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, seat_id)  -- only one hold per seat per event at a time
);

CREATE INDEX idx_seat_holds_expires ON seat_holds(hold_expires_at);
CREATE INDEX idx_seat_holds_customer ON seat_holds(customer_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKINGS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE bookings (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          UUID NOT NULL REFERENCES events(id),
  customer_id       UUID NOT NULL REFERENCES users(id),
  booking_reference VARCHAR(50) UNIQUE NOT NULL,
  total_amount      DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  status            booking_status NOT NULL DEFAULT 'confirmed',
  qr_code_path      TEXT,          -- path to stored QR PNG
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at      TIMESTAMPTZ
);

CREATE INDEX idx_bookings_customer   ON bookings(customer_id);
CREATE INDEX idx_bookings_event      ON bookings(event_id);
CREATE INDEX idx_bookings_reference  ON bookings(booking_reference);

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKING SEATS (seats in a booking)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE booking_seats (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  seat_id    UUID NOT NULL REFERENCES seat_layout(id),
  price      DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, seat_id)
);

CREATE INDEX idx_booking_seats_booking ON booking_seats(booking_id);
CREATE INDEX idx_booking_seats_seat    ON booking_seats(seat_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- WAITLISTS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE waitlists (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  customer_id      UUID NOT NULL REFERENCES users(id),
  category_id      UUID NOT NULL REFERENCES seat_categories(id),
  position         INT NOT NULL CHECK (position > 0),
  status           waitlist_status NOT NULL DEFAULT 'waiting',
  -- When status='offered': the seat that is being offered to this customer
  offered_seat_id  UUID REFERENCES seat_layout(id),
  offer_token      VARCHAR(64),   -- secure token in the email link
  offer_expires_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, customer_id, category_id)
);

CREATE INDEX idx_waitlists_event_cat ON waitlists(event_id, category_id, status);
CREATE INDEX idx_waitlists_customer  ON waitlists(customer_id);
CREATE INDEX idx_waitlists_offer_token ON waitlists(offer_token);

-- ─────────────────────────────────────────────────────────────────────────────
-- BOOKING HISTORY (audit log)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE booking_history (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id),
  action     VARCHAR(50) NOT NULL,   -- created | cancelled | refunded | verified
  details    JSONB,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_booking_history_booking ON booking_history(booking_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS: updated_at auto-update
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_venues_updated_at
  BEFORE UPDATE ON venues FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_waitlists_updated_at
  BEFORE UPDATE ON waitlists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
