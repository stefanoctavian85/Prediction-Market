# Prediction Markets Platform

A full-stack prediction markets application where users can create markets, place bets on outcomes, and earn winnings based on proportional stake distribution.

---

## Overview

The platform allows users to:

- Register and log in with JWT-based authentication
- Browse, create, and participate in prediction markets
- Place bets on market outcomes and track live odds
- View their active and resolved bets on a profile page
- See a leaderboard ranked by total winnings
- Generate an API key to interact with the platform programmatically

Administrators can:

- Resolve markets by selecting the winning outcome, triggering automatic payout distribution
- Archive markets and refund all bettors

---

## Tech Stack

**Backend:** Bun, Elysia, Drizzle ORM, SQLite  
**Frontend:** React 19, TanStack Router, Tailwind CSS v4, shadcn/ui, Vite

---

## Getting Started

Create a `.env` file inside the `/server` directory with the following content:

```env
DB_FILE_NAME=database.sqlite
JWT_SECRET=<YOUR_JWT_SECRET>
HOST=127.0.0.1
PORT=4001
ADMIN_USERNAME=<YOUR_ADMIN_USERNAME>
ADMIN_PASSWORD=<YOUR_ADMIN_PASSWORD>
ADMIN_EMAIL=<YOUR_ADMIN_EMAIL>
```

Then start the entire stack with Docker Compose:

```bash
docker-compose up -d
```

---

## Database

**Run migrations**

```bash
bun run db:migrate
```

**Seed the database**

```bash
# Seed with generated fake data
bun run db:seed

# Delete all data and reseed
bun run db:reset

# Delete all data
bun run db:delete
```

The seed script generates 100 users, 100 markets, and a proportional number of bets. An admin account is created from the environment variables defined above.

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register a new user | No |
| POST | `/api/auth/login` | Log in and receive a JWT | No |

### Markets

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/markets` | List markets | No |
| GET | `/api/markets/:id` | Get market detail | No |
| GET | `/api/markets/outcomes/:marketId` | Get market outcomes | No |
| POST | `/api/markets` | Create a market | Yes |
| POST | `/api/markets/:id/bets` | Place a bet | Yes |
| PATCH | `/api/markets/resolve/:marketId/:outcomeId` | Resolve a market | Admin only |
| PATCH | `/api/markets/archive/:marketId` | Archive a market | Admin only |

**Query parameters for `GET /api/markets`:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `active` | Filter by status: `active`, `resolved`, `archived` |
| `sortField` | string | `createdAt` | Sort field: `createdAt`, `totalMarketBets`, `participants` |
| `sortOrder` | string | `asc` | Sort order: `asc`, `desc` |
| `page` | number | `1` | Page number |
| `pageLimit` | number | `20` | Items per page |

### Profile

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/profile/:id/bets` | Get user bets | Yes |
| GET | `/api/profile/user/:id` | Get user information | Yes |
| GET | `/api/profile/user/generateApiKey/:id` | Generate API key | Yes |

### Leaderboard

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/leaderboard` | Get top 20 users by winnings | Yes |

---

## Authentication

The API uses JWT bearer token authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are issued on registration and login. You can also generate your API key and use it as token if you want to place bets with bots.

---

## Role System

There are two roles: `user` and `admin`.

- **user** — can create markets, place bets, view profiles and leaderboard
- **admin** — all user permissions, plus the ability to resolve and archive markets

Admin credentials are configured via environment variables and created during database seeding.

---

## Real-Time Updates

The platform uses Server-Sent Events (SSE) for real-time updates. Connect to the `/sse` endpoint to receive the following events:

| Event type | Payload | Description |
|------------|---------|-------------|
| `market_created` | — | A new market was created |
| `bet_placed` | `{ marketId }` | A bet was placed on a market |
| `market_resolved` | — | A market was resolved |
| `market_archived` | — | A market was archived |

---

## API Key Authentication

Users can generate an API key from their profile page to interact with the API programmatically without using JWT. The API key is shown only once at generation time.

Include the API key in the same `Authorization` header:

```
Authorization: Bearer <api_key>
```

All endpoints that support JWT authentication also support API key authentication. This allows programmatic access to create markets, list markets, place bets, and view outcomes.

---

## Running Tests

```bash
# From /server
bun test
```

Tests cover authentication, market creation and retrieval, bet placement, profile endpoints, admin authorization, and leaderboard.