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

        if (currentCount > limit) {
            return res.status(429).json({
                message: "Too many requests"
            });
        }

        next();
    };
}

module.exports = rateLimiter;