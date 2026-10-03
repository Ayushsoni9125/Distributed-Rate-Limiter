const rateLimitConfig = {
    default: {
        limit: 5,
        windowInSeconds: 60,
        algorithm: "fixed-window"
    },

    products: {
        limit: 3,
        windowInSeconds: 60,
        algorithm: "sliding-window"
    },

    burst: {
        algorithm: "token-bucket"
    },

    failureMode: "open"
};

module.exports = rateLimitConfig;