<div align="center">

# 🚦 Distributed Rate Limiter

**A Redis-backed distributed rate limiter built with Node.js — no third-party rate-limit libraries.**

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Redis](https://img.shields.io/badge/Redis-7.x-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com)
[![Jest](https://img.shields.io/badge/Jest-Tests-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io)
[![k6](https://img.shields.io/badge/k6-Load%20Tests-7D64FF?style=for-the-badge&logo=k6&logoColor=white)](https://k6.io)

</div>

---

## Architecture

![Distributed Rate Limiter Architecture](./architecture.jpg)

---

## How It Works

Each incoming request passes through this pipeline:

```
Client Request
    │
    ▼
Authentication         (JWT via auth.js  OR  API Key via apiKeyAuth.js)
    │
    ▼
rateLimitPolicy()      Selects algorithm based on route policy + user plan
    │
    ├── Fixed Window   → rateLimiter.js        → rateLimitScript.js  (Lua)
    ├── Sliding Window → slidingWindowRateLimiter.js → slidingWindowScript.js (Lua)
    └── Token Bucket   → tokenBucketRateLimiter.js  → tokenBucketScript.js  (Lua)
                │
                ▼
        Redis (atomic Lua eval)
        Key: rate-limit:<clientId>:<routeId>
                │
        ┌───────┴───────┐
        ▼               ▼
    HTTP 200        HTTP 429
    + Headers       + Retry-After
```

### Client Identification (`clientIdentifier.js`)

Priority order for the Redis key scope:

```
1. API Key  →  rate-limit:apiKey:<id>:<route>
2. JWT User →  rate-limit:user:<id>:<route>
3. IP       →  rate-limit:ip:<addr>:<route>   (unauthenticated fallback)
```

---

## Rate Limit Algorithms

### Fixed Window (`rateLimitScript.js`)
Uses Redis `INCR` + `EXPIRE`. Counter resets at the end of each fixed window.

```lua
local currentCount = redis.call("INCR", KEYS[1])
if currentCount == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return { currentCount, ttl }
```

### Sliding Window (`slidingWindowScript.js`)
Uses a Redis Sorted Set. Each request is stored with a millisecond timestamp as its score.
The lower boundary is **exclusive** `(` to prevent edge-case double-counting.

```lua
redis.call("ZREMRANGEBYSCORE", key, "-inf", "(" .. windowStart)
local currentCount = redis.call("ZCARD", key)
if currentCount >= limit then return {0, currentCount, retryAfter} end
redis.call("ZADD", key, now, requestId)
redis.call("EXPIRE", key, math.ceil(window / 1000))
return {1, currentCount + 1, 0}
```

### Token Bucket (`tokenBucketScript.js`)
Uses a Redis Hash with `tokens` and `lastRefillTime`. Tokens refill continuously based on elapsed time.

```lua
local elapsed = (now - lastRefillTime) / 1000
tokens = math.min(capacity, tokens + elapsed * refillRate)
if tokens >= 1 then
    tokens = tokens - 1
    -- save + return allowed
end
-- return denied + retryAfter
```

---

## Authentication

### JWT (`auth.js`)
Verifies `Authorization: Bearer <token>`, looks up the user in PostgreSQL, and sets `req.user = { id, plan }`.

### API Key (`middleware/apiKeyAuth.js`)
Reads `X-API-Key` header. Uses the first 8 characters as a `keyPrefix` for an indexed PostgreSQL lookup, then `bcrypt.compare`s the full key. Sets both `req.apiKey` and `req.user` (inherited from the key's owner).

---

## Plan-Based Limits (`planConfig.js`)

| Endpoint | Algorithm | Free | Pro | Enterprise |
|---|---|---|---|---|
| `/api/test`, `/api/profile`, `/api/data`, `/api/key-test` | Fixed Window | 5 / 60s | 50 / 60s | 200 / 60s |
| `/api/products` | Sliding Window | 3 / 60s | 20 / 60s | 100 / 60s |
| `/api/burst` | Token Bucket | cap=5, fill=1/s | cap=20, fill=5/s | cap=50, fill=10/s |

---

## API Endpoints

### Auth

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register a new user |
| POST | `/api/auth/login` | None | Login, returns JWT |

### API Keys

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/keys` | JWT | Create an API key |
| GET | `/api/keys` | JWT | List your API keys |
| DELETE | `/api/keys/:id` | JWT | Revoke an API key |

### Rate-Limited

| Method | Route | Auth | Algorithm | Policy |
|---|---|---|---|---|
| GET | `/api/test` | JWT | Fixed Window | `default` |
| GET | `/api/profile` | JWT | Fixed Window | `default` |
| GET | `/api/products` | JWT | Sliding Window | `products` |
| GET | `/api/burst` | JWT | Token Bucket | `burst` |
| GET | `/api/key-test` | API Key | Fixed Window | `default` |
| GET | `/api/data` | JWT **or** API Key | Fixed Window | `default` |

### Response Headers

```
X-RateLimit-Limit:     5
X-RateLimit-Remaining: 3
X-RateLimit-Reset:     42
Retry-After:           42   (only on 429)
```

---

## Failure Modes (`config.js`)

```javascript
failureMode: "open"    // Redis down → allow request through (default)
failureMode: "closed"  // Redis down → HTTP 503
```

The Redis client uses `disableOfflineQueue: true` so failures surface immediately without hanging.

---

## Database Schema (`prisma/schema.prisma`)

```prisma
model User {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  password  String
  plan      String   @default("free")
  createdAt DateTime @default(now())
  apiKeys   ApiKey[]
}

model ApiKey {
  id        Int       @id @default(autoincrement())
  key       String    @unique   // bcrypt hash
  keyPrefix String              // first 8 chars — non-secret lookup index
  userId    Int
  createdAt DateTime  @default(now())
  expiresAt DateTime?
  active    Boolean   @default(true)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## Getting Started

### Prerequisites

- Node.js 22+
- Redis 7+ on `localhost:6379`
- PostgreSQL 17+

### Setup

```bash
git clone https://github.com/Ayushsoni9125/Distributed-Rate-Limiter.git
cd Distributed-Rate-Limiter
npm install

# configure .env
DATABASE_URL="postgresql://user:password@localhost:5432/ratelimiter"
JWT_SECRET="your-secret-key"

npx prisma migrate deploy
node server.js
```

Server starts on `http://localhost:5056` (override with `PORT=5057 node server.js`).

---

## Running Tests

```bash
npm test
```

25 tests across 9 files:

| File | What it tests |
|---|---|
| `health.test.js` | Fixed Window, Sliding Window, Token Bucket core limits |
| `1_headers.test.js` | Rate limit response headers |
| `2_auth.test.js` | JWT validation, API Key auth, JWT vs API Key identity |
| `3_isolation.test.js` | User isolation, route isolation, API key isolation |
| `4_plans.test.js` | Free / Pro / Enterprise plan limits, API key plan resolution |
| `5_apikey.test.js` | Create, list, revoke, expire, invalid key |
| `6_algorithms.test.js` | Retry-After, token refill, capacity cap |
| `7_failure.test.js` | Fail-open and fail-closed behavior |
| `8_concurrency.test.js` | Concurrent requests, Redis Lua atomicity |

---

## Load Testing (k6)

```bash
JWT_TOKEN="<token>" k6 run load-tests/rate-limiter.js
```

Config: 50 VUs, 10 seconds, targeting `GET /api/test`.

### Results (50 VUs, Fixed Window)

| Metric | Value |
|---|---|
| Throughput | ~11,622 req/s |
| Avg latency | 4.27 ms |
| p95 latency | 5.93 ms |
| Max latency | 54.22 ms |
| Check success | 100% |
| Connection errors | 0 |

---

## Distributed Consistency

Two instances (`PORT=5056` and `PORT=5057`) were run simultaneously against the same Redis.
Requests alternated between both ports.

```
Request 1 → 5056 → 200
Request 2 → 5057 → 200
Request 3 → 5056 → 200
Request 4 → 5057 → 200
Request 5 → 5056 → 200
Request 6 → 5057 → 429  ← shared limit correctly enforced
```

The rate-limit counter is shared across all instances via Redis — no local in-memory state.

---

## Project Structure

```
├── server.js                    # Express app and routes
├── config.js                    # Route policies and failureMode
├── planConfig.js                # Per-plan quotas (free/pro/enterprise)
├── auth.js                      # JWT middleware
├── clientIdentifier.js          # apiKey > user > IP priority
├── routeIdentifier.js           # Route name extractor
├── redis.js                     # Redis client
├── prismaClient.js              # Prisma singleton
├── rateLimitPolicy.js           # Selects correct algorithm middleware
├── planPolicy.js                # Merges plan overrides into policy
├── rateLimiter.js               # Fixed Window middleware
├── rateLimitScript.js           # Fixed Window Lua script
├── slidingWindowRateLimiter.js  # Sliding Window middleware
├── slidingWindowScript.js       # Sliding Window Lua script
├── tokenBucketRateLimiter.js    # Token Bucket middleware
├── tokenBucketScript.js         # Token Bucket Lua script
├── middleware/apiKeyAuth.js     # API Key authentication
├── controllers/                 # authController, apiKeyController
├── routes/                      # authRoutes, apiKeyRoutes
├── utils/generateApiKey.js      # Secure key generator
├── prisma/schema.prisma         # DB schema
├── tests/                       # Jest + Supertest test suite
└── load-tests/rate-limiter.js   # k6 load test
```

---

## License

ISC
