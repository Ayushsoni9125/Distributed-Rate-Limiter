const { createClient } = require("redis");

const redisClient = createClient({
    url: "redis://localhost:6379",
    disableOfflineQueue: true
});
redisClient.on("error", (error) => {
    console.error("Redis Error:", error);
});

async function connectRedis() {
    await redisClient.connect();
    console.log("Redis connected");
}

module.exports = {
    redisClient,
    connectRedis
};