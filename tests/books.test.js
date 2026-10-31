const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

describe("Books API", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeAll(async () => {
    const result = await prisma.$queryRaw`
    SELECT current_database() AS database_name
  `;

    expect(result[0].database_name).toBe("library_test");
  });

  test("GET /api/books returns 200 and a list of books", async () => {
    const response = await request(app).get("/api/books");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });
  test("POST /api/books creates a book with available copies", async () => {
    const bookData = {
      title: "Automated Test Book",
      author: "Test Author",
      isbn: `TEST-${Date.now()}`,
      totalCopies: 5,
    };

    let createdBookId;

    try {
      const response = await request(app).post("/api/books").send(bookData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      const book = response.body.data;

      createdBookId = book?.id;

      expect(book).toMatchObject({
        title: bookData.title,
        author: bookData.author,
        isbn: bookData.isbn,
        totalCopies: 5,
        availableCopies: 5,
      });

      const savedBook = await prisma.book.findUnique({
        where: { id: createdBookId },
      });

      expect(savedBook).not.toBeNull();
      expect(savedBook.isbn).toBe(bookData.isbn);
    } finally {
      if (createdBookId !== undefined) {
        await prisma.book.deleteMany({
          where: { id: createdBookId, isbn: bookData.isbn },
        });
      }
    }
  });
  test("POST /api/books rejects invalid book data with 400", async () => {
    const invalidBook = {
      title: "Invalid Book",
      author: "Test Author",
      isbn: "INVALID-ISBN",
      totalCopies: -3,
    };

    const response = await request(app).post("/api/books").send(invalidBook);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);

    const savedBook = await prisma.book.findUnique({
      where: { isbn: invalidBook.isbn },
    });

    expect(savedBook).toBeNull();
  });

  test("POST /api/books rejects unsupported fields with 400", async () => {
    const isbn = `UNKNOWN-${Date.now()}`;
    const response = await request(app).post("/api/books").send({
      title: "Unsupported Field Test",
      author: "Test Author",
      isbn,
      totalCopies: 2,
      totalCopy: 2,
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    await expect(prisma.book.findUnique({ where: { isbn } })).resolves.toBeNull();
  });
  test("POST /api/books rejects duplicate ISBN with 409", async () => {
    const bookData = {
      title: "Duplicate ISBN Test",
      author: "Test Author",
      isbn: `DUP-${Date.now()}`,
      totalCopies: 3,
    };

    let createdBookId;

    try {
      const firstResponse = await request(app)
        .post("/api/books")
        .send(bookData);

      expect(firstResponse.status).toBe(201);

      createdBookId = firstResponse.body.data?.id;

      const secondResponse = await request(app)
        .post("/api/books")
        .send(bookData);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body.success).toBe(false);

      const matchingBooks = await prisma.book.count({
        where: { isbn: bookData.isbn },
      });

      expect(matchingBooks).toBe(1);
    } finally {
      if (createdBookId !== undefined) {
        await prisma.book.deleteMany({
          where: {
            id: createdBookId,
            isbn: bookData.isbn,
          },
        });
      }
    }
  });
  test("PATCH /api/books/:id updates book data and inventory", async () => {
    const book = await prisma.book.create({
      data: {
        title: "Original Title",
        author: "Test Author",
        isbn: `PATCH-${Date.now()}`,
        totalCopies: 5,
        availableCopies: 5,
      },
    });

    try {
      const response = await request(app).patch(`/api/books/${book.id}`).send({
        title: "Updated Title",
        totalCopies: 8,
      });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      expect(response.body.data).toMatchObject({
        title: "Updated Title",
        totalCopies: 8,
        availableCopies: 8,
      });

      const savedBook = await prisma.book.findUnique({
        where: { id: book.id },
      });

      expect(savedBook.title).toBe("Updated Title");
      expect(savedBook.totalCopies).toBe(8);
      expect(savedBook.availableCopies).toBe(8);
    } finally {
      await prisma.book.deleteMany({
        where: { id: book.id },
      });
    }
  });

  test("PATCH /api/books/:id rejects direct availableCopies updates", async () => {
    const response = await request(app)
      .patch("/api/books/1")
      .send({ availableCopies: 100 });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  test("PATCH /api/books/:id returns 404 for a missing book", async () => {
    const response = await request(app)
      .patch("/api/books/2147483647")
      .send({ title: "Updated Title" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
  test("DELETE /api/books/:id deletes a book with 204", async () => {
    const book = await prisma.book.create({
      data: {
        title: "Book To Delete",
        author: "Test Author",
        isbn: `DELETE-${Date.now()}`,
        totalCopies: 2,
        availableCopies: 2,
      },
    });

    try {
      const response = await request(app).delete(`/api/books/${book.id}`);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");

      const deletedBook = await prisma.book.findUnique({
        where: { id: book.id },
      });

      expect(deletedBook).toBeNull();
    } finally {
      // Cleanup if the test fails before the API deletes the book.
      await prisma.book.deleteMany({
        where: { id: book.id },
      });
    }
  });

  test("DELETE /api/books/:id returns 404 for a missing book", async () => {
    const response = await request(app).delete("/api/books/2147483647");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });
});
