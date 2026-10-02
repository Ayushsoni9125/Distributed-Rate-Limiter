const express = require("express");
const { connectRedis } = require("./redis");
const rateLimitPolicy = require("./rateLimitPolicy");
const authenticate = require("./auth");
const prisma = require("./prismaClient");
const authRoutes = require("./routes/authRoutes");

const app = express();

const port = process.env.PORT || 5056;

app.use(express.json());
app.use("/api/auth", authRoutes);

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
  "/api/products",
  rateLimitPolicy("products"),
  (req, res) => {
    res.json({
      message: "Products API",
    });
  },
);

app.get("/api/users", async (req, res) => {
    try {
        const users = await prisma.user.findMany();

        res.json(users);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to fetch users"
        });
    }
});

async function startServer() {
  await connectRedis();

  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
