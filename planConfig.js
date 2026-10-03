const planConfig = {
    free: {
        default: {
            limit: 5,
            windowInSeconds: 60
        },
        products: {
            limit: 3,
            windowInSeconds: 60
        }
    },

    pro: {
        default: {
            limit: 50,
            windowInSeconds: 60
        },
        products: {
            limit: 20,
            windowInSeconds: 60
        }
    },

    enterprise: {
        default: {
            limit: 200,
            windowInSeconds: 60
        },
        products: {
            limit: 100,
            windowInSeconds: 60
        }
    }
};

module.exports = planConfig;