const rateLimitConfig = {
    default: {
        limit: 5,
        windowInSeconds: 60
    },

    products: {
        limit: 3,
        windowInSeconds: 60
    },

    failureMode: "open"
};

module.exports = rateLimitConfig;