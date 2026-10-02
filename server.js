const express = require("express");
const { connectRedis } = require("./redis");
const rateLimitPolicy = require("./rateLimitPolicy");
const authenticate = require("./auth");
const apiKeyRoutes = require("./routes/apiKeyRoutes");
const authRoutes = require("./routes/authRoutes");
const apiKeyAuth = require("./middleware/apiKeyAuth");

const app = express();

const port = process.env.PORT || 5056;

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/keys", apiKeyRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "Distributed Rate Limiter API is running",
  });
});

app.get(
    "/api/profile",
    authenticate,
    rateLimitPolicy("default"),
    (req, res) => {
        res.json({
            message: "Profile API",
            user: req.user
        });
    }
);

app.get(
  "/api/test",
  rateLimitPolicy("default"),
  (req, res) => {
    res.json({
      message: "Request allowed",
    });
  },
);

app.get(
    "/api/key-test",
    apiKeyAuth,
    (req, res) => {
        res.json({
            message: "API key authentication successful"
        });
    }
);

app.get(
  "/api/products",
  rateLimitPolicy("products"),
  (req, res) => {
    res.json({
      message: "Products API",
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
