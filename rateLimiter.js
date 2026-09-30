const { redisClient } = require("./redis");

function rateLimiter(limit, windowInSeconds) {
    return async (req, res, next) => {
        // using the client's IP address as the identifier.
        // if we want to use the user id, we can use that instead.
        const key = `rate-limit:${req.ip}`;

        // increment the counter for the client.
        const currentCount = await redisClient.incr(key);

        // if the counter is 1, set the expiry time for the key.
        if (currentCount === 1) {
            await redisClient.expire(key, windowInSeconds);
        }

        // Get the time remaining in the window
        const ttl = await redisClient.ttl(key);

        // Calculate the number of requests remaining in the window
        const remaining = Math.max(0, limit - currentCount);

        // Set the rate limit headers
        res.setHeader("X-RateLimit-Limit", limit);
        res.setHeader("X-RateLimit-Remaining", remaining);
        res.setHeader("X-RateLimit-Reset", ttl);

        if (currentCount > limit) {
            res.setHeader("Retry-After", ttl);

            return res.status(429).json({
                message: "Too many requests"
            });
        }

        next();
    };
}

module.exports = rateLimiter;