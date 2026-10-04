const request = require("supertest");
const { app, setupTestDb, teardownTestDb, createUser } = require("./testUtils");
const prisma = require("../prismaClient");

describe("5. API KEY LIFECYCLE", () => {
  beforeAll(setupTestDb);
  afterAll(teardownTestDb);

  test("API Key Lifecycle (Create, List, Delete)", async () => {
    const { token } = await createUser();

    // Create
    const createRes = await request(app).post("/api/keys").set("Authorization", `Bearer ${token}`).send({ name: "Lifecycle Key" }).expect(201);
    expect(createRes.body.apiKey.key).toBeDefined();
    expect(createRes.body.apiKey.keyPrefix).toBeDefined();
    const keyId = createRes.body.apiKey.id;
    const plainKey = createRes.body.apiKey.key;

    // List
    const listRes = await request(app).get("/api/keys").set("Authorization", `Bearer ${token}`).expect(200);
    const listedKey = listRes.body.apiKeys.find(k => k.id === keyId);
    expect(listedKey).toBeDefined();
    expect(listedKey.key).toBeUndefined(); // plaintext key should not be returned

    // Delete
    await request(app).delete(`/api/keys/${keyId}`).set("Authorization", `Bearer ${token}`).expect(200);

    // Verify inactive
    await request(app).get("/api/key-test").set("x-api-key", plainKey).expect(401);
  });

  test("Expired API Key", async () => {
    const { token } = await createUser();
    
    const createRes = await request(app).post("/api/keys").set("Authorization", `Bearer ${token}`).send({ name: "Expired Key" }).expect(201);
    const plainKey = createRes.body.apiKey.key;
    const keyId = createRes.body.apiKey.id;

    // Manually expire the key in DB
    await prisma.apiKey.update({
        where: { id: keyId },
        data: { expiresAt: new Date(Date.now() - 10000) }
    });

    await request(app).get("/api/key-test").set("x-api-key", plainKey).expect(401);
  });

  test("Invalid API Key", async () => {
    await request(app).get("/api/key-test").set("x-api-key", "invalid-value").expect(401);
    await request(app).get("/api/key-test").set("x-api-key", "deadbeef12345678deadbeef").expect(401);
  });
});
