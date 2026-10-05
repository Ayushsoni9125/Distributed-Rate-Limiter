<div align="center">

# 🚦 Distributed Rate Limiter

**A production-grade, Redis-backed distributed rate limiting system built with Node.js.**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io)
[![Jest](https://img.shields.io/badge/Jest-Tests-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io)
[![k6](https://img.shields.io/badge/k6-Load%20Tests-7D64FF?style=for-the-badge&logo=k6&logoColor=white)](https://k6.io)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Algorithms](#-algorithms)
- [Authentication](#-authentication)
- [Plan-Based Limits](#-plan-based-rate-limits)
- [Redis Key Structure](#-redis-key-structure)
- [API Reference](#-api-reference)
- [Failure Handling](#-failure-handling)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Running Tests](#-running-tests)
- [Load Testing](#-load-testing)
- [Performance Results](#-performance-results)
- [Distributed Consistency](#-distributed-consistency-test)

---

## 🌟 Overview

This project implements a **production-grade distributed rate limiter** from scratch — no third-party rate-limit libraries. The entire rate-limiting logic is implemented using **atomic Redis Lua scripts**, guaranteeing correctness even under high concurrency across multiple server instances.

### Key Features

| Feature | Description |
|---|---|
| 🔁 **3 Algorithms** | Fixed Window, Sliding Window, Token Bucket |
| 🗄️ **Redis-Backed** | All state lives in Redis — zero in-memory counters |
| 🔐 **Dual Auth** | JWT Bearer tokens + API Key (`X-API-Key`) |
| 🎯 **Per-Client Isolation** | Per-user, per-API-key, and per-IP buckets |
| 🛣️ **Per-Route Isolation** | Each endpoint has its own independent rate-limit bucket |
| 📋 **Plan-Based Limits** | Free / Pro / Enterprise tiers with different quotas |
| ⚛️ **Atomic Lua Scripts** | Race-condition-free at any concurrency level |
| 🌐 **Horizontally Scalable** | Multiple Node.js instances share a single Redis state |
| 🛡️ **Failure Modes** | Fail-Open (allow) or Fail-Closed (503) when Redis is down |
| 📊 **Rate Limit Headers** | `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, `Retry-After` |

---

## 🏗️ Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                    │
│    Web App / Mobile App / API Consumer / k6 Load Tester             │
└──────────────────────┬──────────────────────────────────────────────┘
                       │  HTTP Requests (JWT Bearer / X-API-Key)
          ┌────────────▼────────────┐
          │   Load Balancer / DNS   │
          └──────┬──────────┬───────┘
                 │          │
    ┌────────────▼──┐   ┌───▼─────────────┐
    │  Node.js API  │   │  Node.js API    │
    │  Instance 1   │   │  Instance 2     │
    │  Port: 5056   │   │  Port: 5057     │
    └───────┬───────┘   └────────┬────────┘
            │  Both connect to SAME Redis │
    ┌────────▼────────────────────▼────────┐
    │        Redis 7.x  (localhost:6379)   │
    │   rate-limit:user:42:default         │
    │   rate-limit:apiKey:7:burst          │
    │   rate-limit:ip:1.2.3.4:default     │
    └──────────────────────────────────────┘
            │
    ┌───────▼────────────────────────────────┐
    │        PostgreSQL  (Prisma ORM)        │
    │  ┌───────────┐    ┌──────────────────┐ │
    │  │   Users   │───▶│    API Keys      │ │
    │  │ id, plan  │    │ key, prefix, exp │ │
    │  └───────────┘    └──────────────────┘ │
    └────────────────────────────────────────┘
```

### Request Middleware Pipeline

```
Incoming HTTP Request
        │
        ▼
┌───────────────────┐
│  express.json()   │  Parse request body
└────────┬──────────┘
         │
         ▼
┌───────────────────────┐
│  Authentication       │
│  JWT:  auth.js        │  Verify JWT → load user.id + user.plan
│  API:  apiKeyAuth.js  │  Prefix lookup → bcrypt.compare → load user.plan
└────────┬──────────────┘
         │ req.user { id, plan }  /  req.apiKey { id }
         ▼
┌───────────────────────────────────────┐
│          rateLimitPolicy()            │
│  1. Reads policy name                 │
│  2. Calls getPlanPolicy() for quotas  │
│  3. Selects algorithm middleware      │
└──────┬──────────────┬────────────┬────┘
       ▼              ▼            ▼
┌──────────┐  ┌──────────────┐  ┌──────────────┐
│  Fixed   │  │   Sliding    │  │    Token     │
│  Window  │  │   Window     │  │    Bucket    │
└────┬─────┘  └──────┬───────┘  └──────┬───────┘
     └───────────────┼─────────────────┘
                     ▼
        ┌────────────────────────┐
        │  getClientIdentifier() │
        │  apiKey:ID  (priority) │
        │  user:ID               │
        │  ip:X.X.X.X (fallback) │
        └──────────┬─────────────┘
                   ▼
        Redis Key: rate-limit:<clientId>:<routeId>
                   ▼
        ┌──────────────────────────────┐
        │   Redis Lua Script (eval)    │  Atomic — no race conditions
        └──────────┬───────────────────┘
                   │
       ┌───────────┴──────────┐
       ▼                      ▼
  HTTP 200               HTTP 429
  next() + Headers      Retry-After Header
```

---

## ⚙️ Algorithms

### 1. Fixed Window (`rateLimiter.js`)

Used by: `/api/test`, `/api/profile`, `/api/key-test`, `/api/data`

```
Time ──────────────────────────────────────────────────────────────▶
       │        Window 1 (60s)         │      Window 2 (60s)       │
       │  ✅ ✅ ✅ ✅ ✅ ❌ ❌ ❌        │  ✅ ✅ ✅ ✅ ✅ ❌ ❌     │
       │← ─ ─ ─ ─ limit=5 ─ ─ ─ ─ ─ ─│← ─ ─ ─ limit=5 ─ ─ ─ ─ ─│
```

**Redis Lua Script (`rateLimitScript.js`):**

```lua
local currentCount = redis.call("INCR", KEYS[1])
if currentCount == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])  -- Set TTL only on first request
end
local ttl = redis.call("TTL", KEYS[1])
return { currentCount, ttl }
```

**Data Structure:** `STRING` (integer counter) — TTL = window size (60 seconds)

---

### 2. Sliding Window (`slidingWindowRateLimiter.js`)

Used by: `/api/products`

```
                    now = T
                     │
◄── 60s window ──────┤
  T-60          T-30 │    T
  ─────────────────────────────────▶ time
    [req1] [req2]  [req3]│
                         │← New request here would be blocked (limit=3)
```

**Redis Lua Script (`slidingWindowScript.js`):**

```lua
-- Remove requests outside the rolling window (exclusive lower boundary)
redis.call("ZREMRANGEBYSCORE", key, "-inf", "(" .. windowStart)
local currentCount = redis.call("ZCARD", key)
if currentCount >= limit then
    -- Calculate exact Retry-After from oldest timestamp in window
    return {0, currentCount, retryAfter}
end
redis.call("ZADD", key, now, requestId)  -- Score = timestamp
redis.call("EXPIRE", key, math.ceil(window / 1000))
return {1, currentCount + 1, 0}
```

**Data Structure:** `SORTED SET` (timestamp-scored members). Exclusive lower bound `(` prevents edge-case double-counting.

---

### 3. Token Bucket (`tokenBucketRateLimiter.js`)

Used by: `/api/burst`

```
  Bucket starts full (capacity=5)
  ┌─────────────────────────────┐
  │  🪙 🪙 🪙 🪙 🪙             │  Full (5 tokens)
  └─────────────────────────────┘
     │ Request arrives → consume 1 token
  ┌─────────────────────────────┐
  │                             │  Empty → HTTP 429
  └─────────────────────────────┘
     │ Wait 1 second (refillRate=1/s)
  ┌─────────────────────────────┐
  │  🪙                         │  1 token refilled → HTTP 200
  └─────────────────────────────┘
```

**Redis Lua Script (`tokenBucketScript.js`):**

```lua
local data = redis.call("HMGET", key, "tokens", "lastRefillTime")
local elapsed = (now - lastRefillTime) / 1000
local refilledTokens = elapsed * refillRate
tokens = math.min(capacity, tokens + refilledTokens)  -- Cap at capacity
if tokens >= 1 then
    tokens = tokens - 1
    redis.call("HSET", key, "tokens", tokens, "lastRefillTime", now)
    redis.call("EXPIRE", key, math.ceil((capacity / refillRate) * 2))
    return {1, tokens, 0}
end
return {0, tokens, retryAfter}
```

**Data Structure:** `HASH` (`tokens`, `lastRefillTime`). TTL adapts to plan config.

---

## 🔐 Authentication

### JWT Authentication (`auth.js`)

```
Client  ──▶  Authorization: Bearer <jwt_token>
                    │
                    ▼
           jwt.verify(token, JWT_SECRET)
                    ▼
           prisma.user.findUnique(decoded.userId)
                    ▼
           req.user = { id, plan }
```

### API Key Authentication (`middleware/apiKeyAuth.js`)

Uses a **prefix-based lookup** strategy to avoid bcrypt-comparing every stored key.

```
Client  ──▶  X-API-Key: abcd1234xxxxxxxxxxx
                    │
         keyPrefix = key.substring(0, 8) → "abcd1234"
                    ▼
         prisma.apiKey.findMany({ where: { keyPrefix, active: true } })
                    │   (O(1) lookup, not O(N) scan)
                    ▼
         bcrypt.compare(providedKey, candidate.key)
                    ▼
         Check: active? expired?
                    ▼
         req.apiKey = { id }
         req.user   = { id, plan }  ← inherited from owning user
```

### Client Identity Priority (`clientIdentifier.js`)

```javascript
if (req.apiKey?.id)  →  "apiKey:<id>"    // Highest priority
if (req.user?.id)    →  "user:<id>"      // JWT users
else                 →  "ip:<ip>"        // Unauthenticated fallback
```

This ordering ensures two API keys belonging to the **same user** have **separate** rate-limit buckets.

---

## 📊 Plan-Based Rate Limits

Every user is assigned a plan. API keys inherit their owner's plan automatically.

| Endpoint | Algorithm | Free | Pro | Enterprise |
|---|---|---|---|---|
| `/api/test` | Fixed Window | 5 req / 60s | 50 req / 60s | 200 req / 60s |
| `/api/profile` | Fixed Window | 5 req / 60s | 50 req / 60s | 200 req / 60s |
| `/api/data` | Fixed Window | 5 req / 60s | 50 req / 60s | 200 req / 60s |
| `/api/key-test` | Fixed Window | 5 req / 60s | 50 req / 60s | 200 req / 60s |
| `/api/products` | Sliding Window | 3 req / 60s | 20 req / 60s | 100 req / 60s |
| `/api/burst` | Token Bucket | cap=5, fill=1/s | cap=20, fill=5/s | cap=50, fill=10/s |

---

## 🗝️ Redis Key Structure

```
rate-limit : <clientIdentifier> : <routeIdentifier>
    │               │                    │
    │               │                    └── "default" / "products" / "burst"
    │               └── "user:42" / "apiKey:7" / "ip:1.2.3.4"
    └── Fixed namespace prefix

Examples:
  rate-limit:user:42:default        # JWT user 42 on /api/test
  rate-limit:user:42:products       # JWT user 42 on /api/products (separate bucket!)
  rate-limit:apiKey:7:default       # API Key #7 on /api/key-test
  rate-limit:apiKey:8:default       # API Key #8 on /api/key-test (different bucket!)
  rate-limit:ip:192.168.1.1:default # Unauthenticated IP fallback
```

---

## 📡 API Reference

### Auth Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | None | Register a new user |
| `POST` | `/api/auth/login` | None | Login and receive JWT |

```bash
# Register
POST /api/auth/register
{ "name": "Alice", "email": "alice@example.com", "password": "secret123" }

# Login
POST /api/auth/login
{ "email": "alice@example.com", "password": "secret123" }
# Response: { "token": "eyJhbGciOiJIUzI1NiIs..." }
```

### API Key Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/keys` | JWT | Create a new API key |
| `GET` | `/api/keys` | JWT | List all API keys |
| `DELETE` | `/api/keys/:id` | JWT | Revoke an API key |

```bash
# Create API Key
POST /api/keys
Authorization: Bearer <jwt>
# Response (201):
# { "apiKey": { "id": 1, "key": "plaintext-only-shown-once", "keyPrefix": "abcd1234" } }
```

### Rate-Limited Endpoints

| Method | Endpoint | Auth | Algorithm | Policy |
|---|---|---|---|---|
| `GET` | `/api/test` | JWT | Fixed Window | `default` |
| `GET` | `/api/profile` | JWT | Fixed Window | `default` |
| `GET` | `/api/products` | JWT | Sliding Window | `products` |
| `GET` | `/api/burst` | JWT | Token Bucket | `burst` |
| `GET` | `/api/key-test` | API Key | Fixed Window | `default` |
| `GET` | `/api/data` | JWT or API Key | Fixed Window | `default` |

### Rate Limit Response Headers

```
X-RateLimit-Limit:     5    # Configured limit
X-RateLimit-Remaining: 3    # Requests left in window
X-RateLimit-Reset:     42   # Seconds until window resets
```

### Rate Limit Exceeded (HTTP 429)

```json
Retry-After: 42
X-RateLimit-Remaining: 0

{ "message": "Too many requests" }
```

---

## 🛡️ Failure Handling

Controlled by `config.js`:

```javascript
failureMode: "open"    // Allow requests through when Redis is down (default)
failureMode: "closed"  // Return HTTP 503 when Redis is down
```

```
Redis Unavailable
       │
       ▼
  try { eval Lua script }
  catch (RedisError)
       │
       ├── failureMode === "open"   ──▶  next()   (request allowed)
       └── failureMode === "closed" ──▶  HTTP 503  { "message": "Rate limiter unavailable" }
```

`disableOfflineQueue: true` ensures Redis failures surface **instantly** (no hanging).

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Runtime** | Node.js 22 |
| **Framework** | Express 5 |
| **Rate Limit State** | Redis 7 (`node-redis` v6) |
| **Database** | PostgreSQL 17 (via Prisma ORM) |
| **Authentication** | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| **Testing** | Jest + Supertest |
| **Load Testing** | k6 v2.3.0 |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- Redis 7+ (running on `localhost:6379`)
- PostgreSQL 17+

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Ayushsoni9125/Distributed-Rate-Limiter.git
cd Distributed-Rate-Limiter

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 4. Apply database migrations
npx prisma migrate deploy

# 5. Start the server
node server.js
# Server running on http://localhost:5056
```

### Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/ratelimiter"
JWT_SECRET="your-secret-key"
PORT=5056   # Optional, defaults to 5056
```

### Running Multiple Instances (Horizontal Scaling)

```bash
# Terminal 1
PORT=5056 node server.js

# Terminal 2
PORT=5057 node server.js
```

Both instances share the same Redis state automatically — no extra configuration needed.

---

## 🧪 Running Tests

```bash
npm test
```

### Test Coverage (25 tests across 9 files)

| Test File | Coverage Area |
|---|---|
| `health.test.js` | Core Fixed / Sliding / Token Bucket limits |
| `1_headers.test.js` | Rate limit response headers |
| `2_auth.test.js` | JWT validation, API Key identification, JWT vs API Key identity |
| `3_isolation.test.js` | User isolation, Route isolation, API Key isolation |
| `4_plans.test.js` | Free / Pro / Enterprise plan limits + API Key plan resolution |
| `5_apikey.test.js` | API key lifecycle (create, list, revoke, expire, invalid key) |
| `6_algorithms.test.js` | Retry-After headers, Token Bucket refill & capacity cap |
| `7_failure.test.js` | Fail-Open and Fail-Closed Redis failure modes |
| `8_concurrency.test.js` | Concurrent requests, Redis Lua atomicity, multi-user concurrency |

---

## 📈 Load Testing

```bash
# Get a JWT token
TOKEN=$(curl -s -X POST http://localhost:5056/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' | jq -r '.token')

# Run the k6 load test
JWT_TOKEN="$TOKEN" k6 run load-tests/rate-limiter.js
```

---

## 📊 Performance Results

Benchmarked at **50 concurrent virtual users** over **10 seconds**.

### All Three Algorithms (50 VUs)

| Metric | Fixed Window | Sliding Window | Token Bucket |
|---|---|---|---|
| **Throughput** | 11,622 req/s | 12,021 req/s | 11,747 req/s |
| **Avg Latency** | 4.27 ms | 4.12 ms | 4.22 ms |
| **Median** | 3.95 ms | 3.93 ms | 3.99 ms |
| **p90** | 5.39 ms | 4.82 ms | 5.09 ms |
| **p95** | 5.93 ms | 5.67 ms | 5.71 ms |
| **Max** | 54.22 ms | 27.94 ms | 25.09 ms |
| **Checks Passed** | 100.00% | 100.00% | 100.00% |
| **Connection Errors** | 0 | 0 | 0 |

### Baseline vs Stress Test (Fixed Window)

| Metric | 5 VUs (Baseline) | 50 VUs (Stress) |
|---|---|---|
| **Throughput** | 10,300 req/s | 11,622 req/s |
| **Avg Latency** | 0.47 ms | 4.27 ms |
| **p95 Latency** | 0.57 ms | 5.93 ms |
| **Checks Passed** | 100.00% | 100.00% |

> The latency increase at higher concurrency follows **Little's Law** — a 10× increase in concurrency at maximum throughput causes a proportional increase in queue depth and therefore latency. The system remained perfectly stable with zero errors or crashes.

---

## 🌐 Distributed Consistency Test

Two server instances (`5056` and `5057`) were run simultaneously against the **same Redis instance** to verify shared state.

```
TEST 1: Alternating 5056 → 5057  (7 requests, limit = 5)
  Request 1 → port 5056 → HTTP 200  ✅
  Request 2 → port 5057 → HTTP 200  ✅
  Request 3 → port 5056 → HTTP 200  ✅
  Request 4 → port 5057 → HTTP 200  ✅
  Request 5 → port 5056 → HTTP 200  ✅
  Request 6 → port 5057 → HTTP 429  🚫  ← Correctly blocked
  Request 7 → port 5056 → HTTP 429  🚫  ← Correctly blocked

TEST 2: Alternating 5057 → 5056  (7 requests, limit = 5)
  Result: 5 × HTTP 200,  2 × HTTP 429  ✅

TEST 3: Concurrent burst (6 parallel requests split across both ports)
  Result: 5 × HTTP 200,  1 × HTTP 429  ✅
```

### Conclusion

> **✅ YES — The rate limit IS globally shared across multiple Node.js instances.**
>
> The combined request count across both separate server instances is correctly limited to the configured policy limit. Neither instance maintains its own local counter. All rate-limit state is exclusively managed through atomic Redis Lua scripts, making this system truly distributed and horizontally scalable.

---

## 📁 Project Structure

```
distributed-rate-limiter/
│
├── server.js                    # Express app & route definitions
├── config.js                    # Policy definitions & failureMode
├── planConfig.js                # Per-plan quota (free/pro/enterprise)
│
├── auth.js                      # JWT authentication middleware
├── clientIdentifier.js          # API Key > User > IP priority logic
├── routeIdentifier.js           # Route name extractor
├── redis.js                     # Redis client (disableOfflineQueue)
├── prismaClient.js              # Prisma client singleton
│
├── rateLimitPolicy.js           # Policy orchestrator (selects algorithm)
├── planPolicy.js                # Merges plan overrides into base policy
│
├── rateLimiter.js               # Fixed Window middleware
├── rateLimitScript.js           # Fixed Window Lua script
│
├── slidingWindowRateLimiter.js  # Sliding Window middleware
├── slidingWindowScript.js       # Sliding Window Lua script (exclusive boundary)
│
├── tokenBucketRateLimiter.js    # Token Bucket middleware
├── tokenBucketScript.js         # Token Bucket Lua script (HMGET/HSET)
│
├── middleware/
│   └── apiKeyAuth.js            # API Key auth (prefix-based O(1) lookup)
│
├── controllers/
│   ├── authController.js        # Register / Login handlers
│   └── apiKeyController.js      # Create / List / Revoke API key handlers
│
├── routes/
│   ├── authRoutes.js            # /api/auth/*
│   └── apiKeyRoutes.js          # /api/keys/*
│
├── utils/
│   └── generateApiKey.js        # Cryptographically secure key generator
│
├── prisma/
│   └── schema.prisma            # User + ApiKey data models
│
├── tests/
│   ├── testUtils.js             # Shared test helpers (createUser, createApiKey)
│   ├── health.test.js           # Core algorithm smoke tests
│   ├── 1_headers.test.js        # Rate limit headers
│   ├── 2_auth.test.js           # Auth + identification
│   ├── 3_isolation.test.js      # User / Route / API Key isolation
│   ├── 4_plans.test.js          # Plan-based limits
│   ├── 5_apikey.test.js         # API key lifecycle
│   ├── 6_algorithms.test.js     # Retry-After, refill, capacity
│   ├── 7_failure.test.js        # Fail-Open / Fail-Closed
│   └── 8_concurrency.test.js    # Concurrent atomicity
│
└── load-tests/
    └── rate-limiter.js          # k6 load test (50 VUs, 10s)
```

---

## 📄 License

This project is licensed under the **ISC License**.

---

<div align="center">

**Built with ❤️ by [Ayush Soni](https://github.com/Ayushsoni9125)**

*A resume-grade distributed systems project demonstrating production-ready rate limiting.*

</div>
