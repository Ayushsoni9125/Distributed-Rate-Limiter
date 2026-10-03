const rateLimitConfig = require("./config");
const rateLimiter = require("./rateLimiter");
const slidingWindowRateLimiter = require("./slidingWindowRateLimiter");
const tokenBucketRateLimiter = require("./tokenBucketRateLimiter");
const getPlanPolicy = require("./planPolicy");

function rateLimitPolicy(policyName) {
    const policy = rateLimitConfig[policyName];

    if (!policy) {
        throw new Error(`Rate limit policy "${policyName}" not found`);
    }

    return (req, res, next) => {
        const planPolicy = getPlanPolicy(
            req,
            policyName,
            policy
        );

        if (policy.algorithm === "token-bucket") {
            return tokenBucketRateLimiter(
                planPolicy.capacity,
                planPolicy.refillRate,
                rateLimitConfig.failureMode
            )(req, res, next);
        }

        const limiter =
            policy.algorithm === "sliding-window"
                ? slidingWindowRateLimiter
                : rateLimiter;

        return limiter(
            planPolicy.limit,
            planPolicy.windowInSeconds,
            rateLimitConfig.failureMode
        )(req, res, next);
    };
}

module.exports = rateLimitPolicy;