const { redisClient } = require("./redis");
const getClientIdentifier = require("./clientIdentifier");
const getRouteIdentifier = require("./routeIdentifier");
const tokenBucketScript = require("./tokenBucketScript");

function tokenBucketRateLimiter(capacity, refillRate, failureMode) {
    return async (req, res, next) => {
        try {
            const clientId = getClientIdentifier(req);
            const routeId = getRouteIdentifier(req);

            const key = `token-bucket:${clientId}:${routeId}`;

            const now = Date.now();

            const [allowed, tokensRemaining, retryAfter] =
                await redisClient.eval(tokenBucketScript, {
                    keys: [key],
                    arguments: [
                        now.toString(),
                        capacity.toString(),
                        refillRate.toString()
                    ]
                });

            res.setHeader("X-RateLimit-Limit", capacity);
            res.setHeader(
                "X-RateLimit-Remaining",
                Math.floor(tokensRemaining)
            );

            if (allowed === 0) {
                const retrySeconds = Math.ceil(retryAfter);

                res.setHeader("Retry-After", retrySeconds);

                res.setHeader(
                    "X-RateLimit-Reset",
                    Math.ceil(Date.now() / 1000) + retrySeconds
                );

                return res.status(429).json({
                    message: "Too many requests"
                });
            }

            next();
        } catch (error) {
            console.error("Token bucket rate limiter error:", error);

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

module.exports = tokenBucketRateLimiter;