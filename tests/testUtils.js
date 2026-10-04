const request = require("supertest");
const app = require("../server");
const { connectRedis, redisClient } = require("../redis");
const prisma = require("../prismaClient");

async function setupTestDb() {
  await connectRedis();
}

async function teardownTestDb() {
  await redisClient.quit();
  await prisma.$disconnect();
}

async function createUser(plan = "free") {
  const ts = Date.now() + Math.random().toString().slice(2,8);
  const email = `test-${ts}@example.com`;
  
  await request(app).post("/api/auth/register").send({
    name: "Test User", email, password: "Test@123"
  }).expect(201);
  
  if (plan !== "free") {
    await prisma.user.update({
      where: { email },
      data: { plan }
    });
  }
  
  const login = await request(app).post("/api/auth/login").send({
    email, password: "Test@123"
  }).expect(200);
  
  return { email, token: login.body.token };
}

async function createApiKey(token) {
  const res = await request(app).post("/api/keys")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "Test Key" })
    .expect(201);
  return res.body.apiKey.key;
}

module.exports = {
  app, setupTestDb, teardownTestDb, createUser, createApiKey
};
