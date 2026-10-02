const rateLimitConfig = require("./config");
const rateLimiter = require("./rateLimiter");
const getPlanPolicy = require("./planPolicy");

function rateLimitPolicy(policyName) {
    const policy = rateLimitConfig[policyName];

    if (!policy) {
        throw new Error(`Rate limit policy "${policyName}" not found`);
    }

    return (req, res, next) => {
        const planPolicy = getPlanPolicy(req, policy);

        return rateLimiter(
            planPolicy.limit,
            planPolicy.windowInSeconds,
            rateLimitConfig.failureMode
        )(req, res, next);
    };
}

module.exports = rateLimitPolicy;