const planConfig = require("./planConfig");

function getPlanPolicy(req, defaultPolicy) {
    const plan = req.user?.plan || "free";

    return planConfig[plan] || defaultPolicy;
}

module.exports = getPlanPolicy;