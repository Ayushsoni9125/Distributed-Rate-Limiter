const planConfig = {
    free: {
        default: {
            limit: 5,
            windowInSeconds: 60
        },
        products: {
            limit: 3,
            windowInSeconds: 60
        },
        burst: {
            capacity: 5,
            refillRate: 1
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
        },
        burst: {
            capacity: 20,
            refillRate: 5
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
        },
        burst: {
            capacity: 50,
            refillRate: 10
        }
    }
};

module.exports = planConfig;