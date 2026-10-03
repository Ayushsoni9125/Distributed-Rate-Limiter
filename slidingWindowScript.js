const slidingWindowScript = `
local key = KEYS[1]

local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local requestId = ARGV[4]

local windowStart = now - window

redis.call("ZREMRANGEBYSCORE", key, "-inf", windowStart)

local currentCount = redis.call("ZCARD", key)

if currentCount >= limit then
    local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    local retryAfter = 0

    if oldest[2] then
        retryAfter = tonumber(oldest[2]) + window - now
    end

    return {0, currentCount, math.max(0, retryAfter)}
end

redis.call("ZADD", key, now, requestId)
redis.call("EXPIRE", key, window)

return {1, currentCount + 1, 0}
`;

module.exports = slidingWindowScript;