const planConfig = require("./planConfig");

function getPlanPolicy(req, policyName, defaultPolicy) {
    const plan = req.user?.plan || "free";

    const planPolicies = planConfig[plan];

    if (!planPolicies) {
        return defaultPolicy;
    }

    return planPolicies[policyName] || defaultPolicy;
}

module.exports = getPlanPolicy;