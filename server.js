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

// API-key authentication test endpoint — now includes rate limiting.
app.get(
    "/api/key-test",
    apiKeyAuth,
    rateLimitPolicy("default"),
    (req, res) => {
        res.json({
            message: "API key authentication successful",
            keyId: req.apiKey.id,
            plan: req.user.plan
        });
    }
);

// Dual-auth endpoint: accepts EITHER a JWT bearer token OR an X-API-Key header.
// JWT path: authenticate sets req.user.
// API key path: apiKeyAuth sets req.apiKey + req.user (from the owning user).
// In both cases planPolicy reads req.user.plan for the correct rate-limit tier.
function authenticateJwtOrApiKey(req, res, next) {
    if (req.headers["x-api-key"]) {
        return apiKeyAuth(req, res, next);
    }
    return authenticate(req, res, next);
}

app.get(
    "/api/data",
    authenticateJwtOrApiKey,
    rateLimitPolicy("default"),
    (req, res) => {
        res.json({
            message: "Data API — accessible via JWT or API key",
            user: req.user,
            authenticatedVia: req.apiKey ? "api_key" : "jwt"
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

app.get("/api/burst", authenticate, rateLimitPolicy("burst"), (req, res) => {
    res.json({
        message: "Token Bucket rate limit working"
    });
});


async function startServer() {
  await connectRedis();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();

