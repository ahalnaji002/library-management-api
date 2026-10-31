const request = require("supertest");
const app = require("../src/app");

describe("Test environment safety", () => {
  test("Jest starts successfully", () => {
    expect(true).toBe(true);
  });

  test("malformed JSON returns 400 without exposing parser details", async () => {
    const response = await request(app)
      .post("/api/books")
      .set("Content-Type", "application/json")
      .send('{"title":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: { message: "Malformed JSON request body" },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|syntaxerror/i);
  });

  test("JSON body over the parser limit returns 413 without details", async () => {
    const oversizedBody = JSON.stringify({ payload: "x".repeat(110 * 1024) });
    const response = await request(app)
      .post("/api/books")
      .set("Content-Type", "application/json")
      .send(oversizedBody);

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      success: false,
      error: { message: "Request body is too large" },
    });
    expect(JSON.stringify(response.body)).not.toMatch(/stack|entity\.too\.large/i);
  });
});
