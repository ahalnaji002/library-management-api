const request = require("supertest");
const app = require("../src/app");

describe("Health API", () => {
  test("GET /health returns 200 and confirms the API is running", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      status: "ok",
      message: "Library Management API is running",
    });
  });
});
