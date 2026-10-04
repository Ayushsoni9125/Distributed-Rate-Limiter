const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser } = require("./testUtils");

describe("8. CONCURRENCY & ISOLATION LOGIC", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);

  test("Redis Atomicity / Concurrency", async () => {
    const { token } = await createUser();

    const promises = [];
    // Send 10 concurrent requests to a fixed window with a limit of 5
    for (let i = 0; i < 10; i++) {
        promises.push(request(app).get("/api/test").set("Authorization", `Bearer ${token}`));
    }
    const responses = await Promise.all(promises);
    
    let allowed = 0;
    let blocked = 0;
    responses.forEach(r => {
        if (r.status === 200) allowed++;
        else if (r.status === 429) blocked++;
    });

    expect(allowed).toBe(5);
    expect(blocked).toBe(5);
  });

  test("Multiple Users Concurrently", async () => {
    const userA = await createUser();
    const userB = await createUser();

    const promisesA = [];
    const promisesB = [];

    for (let i = 0; i < 10; i++) {
        promisesA.push(request(app).get("/api/test").set("Authorization", `Bearer ${userA.token}`));
        promisesB.push(request(app).get("/api/test").set("Authorization", `Bearer ${userB.token}`));
    }

    const responsesA = await Promise.all(promisesA);
    const responsesB = await Promise.all(promisesB);

    const allowedA = responsesA.filter(r => r.status === 200).length;
    const allowedB = responsesB.filter(r => r.status === 200).length;

    expect(allowedA).toBe(5);
    expect(allowedB).toBe(5);
  });

  test("Route Identification and Redis Key Isolation logically", async () => {
    // We already effectively tested route isolation in 3_isolation.test.js
    // Let's do a quick verification
    const { token } = await createUser();
    
    // Exhaust test
    for (let i = 0; i < 6; i++) {
        await request(app).get("/api/test").set("Authorization", `Bearer ${token}`);
    }
    // Verify products is untouched
    await request(app).get("/api/products").set("Authorization", `Bearer ${token}`).expect(200);
  });
});
