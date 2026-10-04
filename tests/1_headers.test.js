const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser } = require("./testUtils");

describe("1. RATE LIMIT HEADERS", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);

  test("Fixed Window headers are returned correctly", async () => {
    const { token } = await createUser();

    const res1 = await request(app)
      .get("/api/test")
      .set("Authorization", `Bearer ${token}`);
      
    expect(res1.status).toBe(200);
    expect(res1.headers["x-ratelimit-limit"]).toBe("5");
    expect(res1.headers["x-ratelimit-remaining"]).toBe("4");
    expect(res1.headers["x-ratelimit-reset"]).toBeDefined();

    let lastRes;
    for (let i = 0; i < 5; i++) {
      lastRes = await request(app)
        .get("/api/test")
        .set("Authorization", `Bearer ${token}`);
    }
    
    expect(lastRes.status).toBe(429);
    expect(lastRes.headers["retry-after"]).toBeDefined();
    expect(lastRes.headers["x-ratelimit-limit"]).toBeDefined();
    expect(lastRes.headers["x-ratelimit-remaining"]).toBe("0");
  });
});
