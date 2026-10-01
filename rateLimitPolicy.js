const rateLimitConfig = require("./config");
const rateLimiter = require("./rateLimiter");

function rateLimitPolicy(policyName) {
    const policy = rateLimitConfig[policyName];

    if (!policy) {
        throw new Error(`Rate limit policy "${policyName}" not found`);
    }

    return rateLimiter(
        policy.limit,
        policy.windowInSeconds,
        rateLimitConfig.failureMode
    );
}

module.exports = rateLimitPolicy;