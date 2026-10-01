const rateLimitScript = `
local currentCount = redis.call("INCR", KEYS[1])

if currentCount == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end

local ttl = redis.call("TTL", KEYS[1])

return { currentCount, ttl }
`;

module.exports = rateLimitScript;