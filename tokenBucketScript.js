const tokenBucketScript = `
local key = KEYS[1]

local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])

local data = redis.call("HMGET", key, "tokens", "lastRefillTime")

local tokens = tonumber(data[1])
local lastRefillTime = tonumber(data[2])

if tokens == nil then
    tokens = capacity
    lastRefillTime = now
end

local elapsed = (now - lastRefillTime) / 1000

local refilledTokens = elapsed * refillRate

tokens = math.min(capacity, tokens + refilledTokens)

if tokens >= 1 then
    tokens = tokens - 1

    redis.call(
        "HSET",
        key,
        "tokens",
        tokens,
        "lastRefillTime",
        now
    )

    redis.call(
    "EXPIRE",
    key,
    math.ceil((capacity / refillRate) * 2)
)

    return {1, tokens, 0}
end

local retryAfter = (1 - tokens) / refillRate

redis.call(
    "HSET",
    key,
    "tokens",
    tokens,
    "lastRefillTime",
    now
)

redis.call(
    "EXPIRE",
    key,
    math.ceil((capacity / refillRate) * 2)
)

return {0, tokens, retryAfter}
`;

module.exports = tokenBucketScript;