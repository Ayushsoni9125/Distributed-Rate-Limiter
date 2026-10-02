const planConfig = {
    free: {
        limit: 5,
        windowInSeconds: 60
    },

    pro: {
        limit: 50,
        windowInSeconds: 60
    },

    enterprise: {
        limit: 200,
        windowInSeconds: 60
    }
};

module.exports = planConfig;