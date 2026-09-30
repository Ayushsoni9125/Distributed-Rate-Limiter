const express = require("express");
const { connectRedis } = require("./redis");
const rateLimiter = require("./rateLimiter");

const app = express();

const port = process.env.PORT || 5056;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Distributed Rate Limiter API is running",
  });
});

// 5 requests per minute
app.get("/api/test", rateLimiter(5, 60), (req, res) => {
  res.json({
    message: "Request allowed",
  });
});

async function startServer() {
  await connectRedis();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
