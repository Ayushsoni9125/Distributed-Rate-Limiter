const { redisClient } = require("./redis");
const getClientIdentifier = require("./clientIdentifier");
const getRouteIdentifier = require("./routeIdentifier");
const slidingWindowScript = require("./slidingWindowScript");

function slidingWindowRateLimiter(limit, windowInSeconds, failureMode) {
    return async (req, res, next) => {
        try {
            const clientId = getClientIdentifier(req);
            const routeId = getRouteIdentifier(req);

            const key = `sliding-rate-limit:${clientId}:${routeId}`;

            const now = Date.now();
            const requestId = `${now}-${Math.random()}`;

            const [allowed, currentCount, retryAfter] =
                await redisClient.eval(slidingWindowScript, {
                    keys: [key],
                    arguments: [
                        now.toString(),
                        (windowInSeconds * 1000).toString(),
                        limit.toString(),
                        requestId
                    ]
                });

            const remaining = Math.max(0, limit - currentCount);

            res.setHeader("X-RateLimit-Limit", limit);
            res.setHeader("X-RateLimit-Remaining", remaining);

            if (allowed === 0) {
                res.setHeader(
                    "Retry-After",
                    Math.ceil(retryAfter / 1000)
                );

                res.setHeader(
                    "X-RateLimit-Reset",
                    Math.ceil((now + retryAfter) / 1000)
                );

                return res.status(429).json({
                    message: "Too many requests"
                });
            }

            res.setHeader(
                "X-RateLimit-Reset",
                Math.ceil((now + windowInSeconds * 1000) / 1000)
            );

            next();
        } catch (error) {
            console.error("Sliding window rate limiter error:", error);

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

module.exports = slidingWindowRateLimiter;