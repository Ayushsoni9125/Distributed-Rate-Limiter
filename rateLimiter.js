const { redisClient } = require("./redis");
const getClientIdentifier = require("./clientIdentifier");
const getRouteIdentifier = require("./routeIdentifier");
const rateLimitScript = require("./rateLimitScript");

function rateLimiter(limit, windowInSeconds, failureMode) {
    return async (req, res, next) => {
        try {
            const clientId = getClientIdentifier(req);
            const routeId = getRouteIdentifier(req);

            const key = `rate-limit:${clientId}:${routeId}`;

            const [currentCount, ttl] = await redisClient.eval(rateLimitScript, {
                keys: [key],
                arguments: [windowInSeconds.toString()]
            });

            const remaining = Math.max(0, limit - currentCount);

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
        } catch (error) {
            console.error("Rate limiter error:", error);

            if (failureMode === "open") {
                next();
            } else {
                return res.status(503).json({
                    message: "Rate limiter unavailable"
                });
            }
        }
    };
}

module.exports = rateLimiter;