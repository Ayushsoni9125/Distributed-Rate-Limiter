const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser, createApiKey } = require("./testUtils");

describe("4. PLANS", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);

  test("Free Plan limits", async () => {
    const { token } = await createUser("free");
    // Default (Fixed) - limit 5
    for(let i=0; i<6; i++) {
        const res = await request(app).get("/api/test").set("Authorization", `Bearer ${token}`);
        if(i<5) expect(res.status).toBe(200); else expect(res.status).toBe(429);
    }
    // Products (Sliding) - limit 3
    for(let i=0; i<4; i++) {
        const res = await request(app).get("/api/products").set("Authorization", `Bearer ${token}`);
        if(i<3) expect(res.status).toBe(200); else expect(res.status).toBe(429);
    }
  });

  test("Pro Plan limits", async () => {
    const { token } = await createUser("pro");
    // Verify it allows more than the free plan
    for(let i=0; i<6; i++) {
        await request(app).get("/api/test").set("Authorization", `Bearer ${token}`).expect(200);
    }
    for(let i=0; i<4; i++) {
        await request(app).get("/api/products").set("Authorization", `Bearer ${token}`).expect(200);
    }
  });

  test("Enterprise Plan limits", async () => {
    const { token } = await createUser("enterprise");
    // Verify it allows more than the free plan
    for(let i=0; i<6; i++) {
        await request(app).get("/api/test").set("Authorization", `Bearer ${token}`).expect(200);
    }
    for(let i=0; i<4; i++) {
        await request(app).get("/api/products").set("Authorization", `Bearer ${token}`).expect(200);
    }
  });

  test("API Key Plan Resolution", async () => {
    const { token } = await createUser("pro");
    const apiKey = await createApiKey(token);
    
    const res = await request(app).get("/api/key-test").set("x-api-key", apiKey).expect(200);
    expect(res.body.plan).toBe("pro");
    
    // Pro limit is 50, so 6 requests should easily pass
    for(let i=0; i<6; i++) {
        await request(app).get("/api/key-test").set("x-api-key", apiKey).expect(200);
    }
  });
});
