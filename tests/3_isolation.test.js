const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser, createApiKey } = require("./testUtils");

describe("3. ISOLATION", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);

  test("User Isolation", async () => {
    const userA = await createUser();
    const userB = await createUser();

    for (let i = 0; i < 6; i++) {
      const res = await request(app).get("/api/test").set("Authorization", `Bearer ${userA.token}`);
      if (i < 5) expect(res.status).toBe(200);
      else expect(res.status).toBe(429);
    }

    const resB = await request(app).get("/api/test").set("Authorization", `Bearer ${userB.token}`);
    expect(resB.status).toBe(200);
  });

  test("Route Isolation", async () => {
    const { token } = await createUser();

    // Consume /api/test limit
    for (let i = 0; i < 6; i++) {
      await request(app).get("/api/test").set("Authorization", `Bearer ${token}`);
    }

    // Call /api/products, should still work
    const res = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test("API Key Isolation", async () => {
    const { token } = await createUser();
    const apiKeyA = await createApiKey(token);
    const apiKeyB = await createApiKey(token);

    for (let i = 0; i < 6; i++) {
      const res = await request(app).get("/api/key-test").set("x-api-key", apiKeyA);
      if (i < 5) expect(res.status).toBe(200);
      else expect(res.status).toBe(429);
    }

    const resB = await request(app).get("/api/key-test").set("x-api-key", apiKeyB);
    expect(resB.status).toBe(200);
  });
});
