const express = require("express");
const { connectRedis } = require("./redis");
const rateLimiter = require("./rateLimiter");
const rateLimitConfig = require("./config");

const app = express();

const port = process.env.PORT || 5056;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Distributed Rate Limiter API is running",
  });
});

app.get(
  "/api/test",
  rateLimiter(
    rateLimitConfig.default.limit,
    rateLimitConfig.default.windowInSeconds,
  ),
  (req, res) => {
    res.json({
      message: "Request allowed",
    });
  },
);

async function startServer() {
  await connectRedis();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
