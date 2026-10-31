const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

describe("Members API", () => {
  const createdMemberIds = [];

  async function createTestMember() {
    const member = await prisma.member.create({
      data: {
        name: "Test Member",
        email: `member-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      },
    });

    createdMemberIds.push(member.id);
    return member;
  }

  beforeAll(async () => {
    const result = await prisma.$queryRaw`
      SELECT current_database() AS database_name
    `;

    expect(result[0].database_name).toBe("library_test");
  });

  afterAll(async () => {
    try {
      if (createdMemberIds.length > 0) {
        await prisma.member.deleteMany({
          where: { id: { in: createdMemberIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("GET /api/members returns a list", async () => {
    const response = await request(app).get("/api/members");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("POST /api/members creates a member", async () => {
    const email = `new-${Date.now()}@example.com`;

    const response = await request(app).post("/api/members").send({
      name: "Ahmed Test",
      email,
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      name: "Ahmed Test",
      email,
    });

    createdMemberIds.push(response.body.data.id);

    const savedMember = await prisma.member.findUnique({
      where: { id: response.body.data.id },
    });

    expect(savedMember).not.toBeNull();
  });

  test("POST /api/members rejects invalid data", async () => {
    const response = await request(app).post("/api/members").send({
      name: "",
      email: "invalid-email",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("POST /api/members rejects unsupported fields with 400", async () => {
    const email = `unsupported-${Date.now()}@example.com`;
    const response = await request(app).post("/api/members").send({
      name: "Unsupported Field Test",
      email,
      phone: "555-0100",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    await expect(prisma.member.findUnique({ where: { email } })).resolves.toBeNull();
  });

  test("POST /api/members rejects duplicate email", async () => {
    const member = await createTestMember();

    const response = await request(app).post("/api/members").send({
      name: "Duplicate Member",
      email: member.email,
    });

    expect(response.status).toBe(409);
    expect(response.body.success).toBe(false);
  });

  test("GET /api/members/:id returns a member", async () => {
    const member = await createTestMember();

    const response = await request(app).get(`/api/members/${member.id}`);

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(member.id);
    expect(response.body.data.email).toBe(member.email);
  });

  test("GET /api/members/:id rejects invalid IDs", async () => {
    const response = await request(app).get("/api/members/abc");

    expect(response.status).toBe(400);
  });

  test("PATCH /api/members/:id updates a member", async () => {
    const member = await createTestMember();

    const response = await request(app)
      .patch(`/api/members/${member.id}`)
      .send({ name: "Updated Member" });

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe("Updated Member");

    const updatedMember = await prisma.member.findUnique({
      where: { id: member.id },
    });

    expect(updatedMember.name).toBe("Updated Member");
  });

  test("PATCH /api/members/:id rejects forbidden fields", async () => {
    const member = await createTestMember();

    const response = await request(app)
      .patch(`/api/members/${member.id}`)
      .send({ createdAt: "2026-01-01" });

    expect(response.status).toBe(400);
  });

  test("DELETE /api/members/:id deletes a member", async () => {
    const member = await createTestMember();

    const response = await request(app).delete(`/api/members/${member.id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");

    const deletedMember = await prisma.member.findUnique({
      where: { id: member.id },
    });

    expect(deletedMember).toBeNull();
  });

  test("DELETE /api/members/:id returns 404 for a missing member", async () => {
    const response = await request(app).delete("/api/members/2147483647");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
