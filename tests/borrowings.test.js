const request = require("supertest");
const app = require("../src/app");
const prisma = require("../src/config/prisma");

describe("Borrowings API", () => {
  const bookIds = [];
  const memberIds = [];

  async function createBook(totalCopies = 2) {
    const book = await prisma.book.create({
      data: {
        title: "Borrowing Test Book",
        author: "Test Author",
        isbn: `borrow-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        totalCopies,
        availableCopies: totalCopies,
      },
    });

    bookIds.push(book.id);
    return book;
  }

  async function createMember() {
    const member = await prisma.member.create({
      data: {
        name: "Borrowing Test Member",
        email: `borrow-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
      },
    });

    memberIds.push(member.id);
    return member;
  }

  function futureDueDate() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function nextFutureYear(matches) {
    let year = new Date().getUTCFullYear() + 1;

    while (!matches(year)) {
      year += 1;
    }

    return year;
  }

  function nextFutureCentury(isLeapCentury) {
    const currentYear = new Date().getUTCFullYear();
    let year = Math.ceil((currentYear + 1) / 100) * 100;

    while (isLeapYear(year) !== isLeapCentury) {
      year += 100;
    }

    return year;
  }

  function futureTimestampWithOffset(offsetMinutes = 330) {
    const futureInstant = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const localTime = new Date(futureInstant.getTime() + offsetMinutes * 60000);
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(offsetMinutes);
    const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
    const offsetRemainder = String(absoluteOffset % 60).padStart(2, "0");

    return `${localTime.toISOString().slice(0, -1)}${sign}${offsetHours}:${offsetRemainder}`;
  }

  function borrowBook(bookId, memberId) {
    return request(app).post("/api/borrowings").send({
      bookId,
      memberId,
      dueAt: futureDueDate(),
    });
  }

  async function waitForBorrowingInsertLock(timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1
          FROM pg_stat_activity
          WHERE datname = current_database()
            AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock'
            AND query ILIKE '%INSERT INTO%Borrowing%'
        ) AS waiting
      `;

      if (result[0].waiting) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error("Timed out waiting for borrowing insert to block");
  }

  beforeAll(async () => {
    const result = await prisma.$queryRaw`
      SELECT current_database() AS database_name
    `;

    expect(result[0].database_name).toBe("library_test");
  });

  afterAll(async () => {
    try {
      // Delete only records linked to this test suite.
      if (bookIds.length > 0 && memberIds.length > 0) {
        await prisma.borrowing.deleteMany({
          where: {
            bookId: { in: bookIds },
            memberId: { in: memberIds },
          },
        });
      }

      if (bookIds.length > 0) {
        await prisma.book.deleteMany({
          where: { id: { in: bookIds } },
        });
      }

      if (memberIds.length > 0) {
        await prisma.member.deleteMany({
          where: { id: { in: memberIds } },
        });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  test("GET /api/borrowings returns a list", async () => {
    const response = await request(app).get("/api/borrowings");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test("POST creates borrowing and decreases available copies", async () => {
    const book = await createBook(2);
    const member = await createMember();

    const response = await borrowBook(book.id, member.id);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.bookId).toBe(book.id);
    expect(response.body.data.memberId).toBe(member.id);
    expect(response.body.data.returnedAt).toBeNull();
    expect(response.body.data.book.availableCopies).toBe(1);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(1);
  });

  test("POST rejects borrowing when no copies are available", async () => {
    const book = await createBook(1);
    const member = await createMember();

    const firstResponse = await borrowBook(book.id, member.id);
    expect(firstResponse.status).toBe(201);

    const secondResponse = await borrowBook(book.id, member.id);

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.success).toBe(false);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(0);

    const borrowingCount = await prisma.borrowing.count({
      where: { bookId: book.id },
    });

    expect(borrowingCount).toBe(1);
  });

  test("POST rejects nonexistent book", async () => {
    const member = await createMember();

    const response = await borrowBook(2147483647, member.id);

    expect(response.status).toBe(404);
  });

  test("POST rejects nonexistent member without decreasing stock", async () => {
    const book = await createBook(2);

    const response = await borrowBook(book.id, 2147483647);

    expect(response.status).toBe(404);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(2);
  });

  test("POST returns 404 when the member is deleted during borrowing", async () => {
    const book = await createBook(2);
    const member = await createMember();

    let releaseDelete;
    let markDeleteStarted;
    const deleteStarted = new Promise((resolve) => {
      markDeleteStarted = resolve;
    });
    const allowDeleteCommit = new Promise((resolve) => {
      releaseDelete = resolve;
    });

    let deleteTransaction;
    let borrowResult;
    let deleteError;
    let startTimer;

    try {
      deleteTransaction = prisma.$transaction(
        async (tx) => {
          await tx.member.delete({ where: { id: member.id } });
          markDeleteStarted();
          await allowDeleteCommit;
        },
        { timeout: 15000 },
      ).then(
        () => null,
        (error) => {
          deleteError = error;
          markDeleteStarted();
          return error;
        },
      );

      const startOutcome = await Promise.race([
        deleteStarted.then(() => "started"),
        deleteTransaction.then((error) => {
          if (error) {
            throw error;
          }

          return "finished";
        }),
        new Promise((_, reject) => {
          startTimer = setTimeout(
            () => reject(new Error("Timed out starting member deletion")),
            5000,
          );
        }),
      ]);
      clearTimeout(startTimer);

      if (startOutcome !== "started" || deleteError) {
        throw deleteError ?? new Error("Member deletion did not start");
      }

      borrowResult = borrowBook(book.id, member.id)
        .timeout({ response: 10000, deadline: 12000 })
        .then(
          (response) => ({ response }),
          (error) => ({ error }),
        );

      await waitForBorrowingInsertLock();
    } finally {
      clearTimeout(startTimer);
      releaseDelete();

      if (deleteTransaction) {
        const error = await deleteTransaction;
        if (error && !deleteError) {
          deleteError = error;
        }
      }

      if (borrowResult) {
        await borrowResult;
      }
    }

    if (deleteError) {
      throw deleteError;
    }

    const { response, error } = await borrowResult;
    if (error) {
      throw error;
    }

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { message: "Member not found" },
    });

    const borrowingCount = await prisma.borrowing.count({
      where: { bookId: book.id, memberId: member.id },
    });
    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(borrowingCount).toBe(0);
    expect(updatedBook.availableCopies).toBe(2);
  });

  test("POST rejects invalid due date", async () => {
    const book = await createBook();
    const member = await createMember();

    const response = await request(app).post("/api/borrowings").send({
      bookId: book.id,
      memberId: member.id,
      dueAt: "2020-01-01T00:00:00.000Z",
    });

    expect(response.status).toBe(400);
  });

  test("POST rejects an impossible non-leap-year date", async () => {
    const book = await createBook();
    const member = await createMember();
    const nonLeapYear = nextFutureYear((year) => !isLeapYear(year));

    const response = await request(app).post("/api/borrowings").send({
      bookId: book.id,
      memberId: member.id,
      dueAt: `${nonLeapYear}-02-29T12:00:00.000Z`,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid due date");
  });

  test("POST accepts February 29 in a leap year", async () => {
    const book = await createBook();
    const member = await createMember();
    const leapYear = nextFutureYear(isLeapYear);
    const dueAt = `${leapYear}-02-29T12:00:00.000Z`;

    const response = await request(app).post("/api/borrowings").send({
      bookId: book.id,
      memberId: member.id,
      dueAt,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.dueAt).toBe(new Date(dueAt).toISOString());
  });

  test("POST accepts a future timestamp with a timezone offset", async () => {
    const book = await createBook();
    const member = await createMember();
    const dueAt = futureTimestampWithOffset(330);

    const response = await request(app).post("/api/borrowings").send({
      bookId: book.id,
      memberId: member.id,
      dueAt,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.dueAt).toBe(new Date(dueAt).toISOString());
  });

  test("POST rejects February 29 in a non-leap century year", async () => {
    const book = await createBook();
    const member = await createMember();
    const nonLeapCentury = nextFutureCentury(false);

    const response = await request(app).post("/api/borrowings").send({
      bookId: book.id,
      memberId: member.id,
      dueAt: `${nonLeapCentury}-02-29T12:00:00.000Z`,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Invalid due date");
  });

  test("POST accepts February 29 in a leap century year", async () => {
    const book = await createBook();
    const member = await createMember();
    const leapCentury = nextFutureCentury(true);
    const dueAt = `${leapCentury}-02-29T12:00:00.000Z`;

    const response = await request(app).post("/api/borrowings").send({
      bookId: book.id,
      memberId: member.id,
      dueAt,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.dueAt).toBe(new Date(dueAt).toISOString());
  });

  test("GET /api/borrowings/:id returns a borrowing", async () => {
    const book = await createBook();
    const member = await createMember();
    const created = await borrowBook(book.id, member.id);

    expect(created.status).toBe(201);

    const response = await request(app).get(
      `/api/borrowings/${created.body.data.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(created.body.data.id);
  });

  test("GET /api/borrowings/member/:memberId returns member borrowings", async () => {
    const book = await createBook();
    const member = await createMember();
    const created = await borrowBook(book.id, member.id);

    expect(created.status).toBe(201);

    const response = await request(app).get(
      `/api/borrowings/member/${member.id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(
      response.body.data.some(
        (borrowing) => borrowing.id === created.body.data.id,
      ),
    ).toBe(true);
  });

  test("PATCH return restores available copies", async () => {
    const book = await createBook(1);
    const member = await createMember();
    const created = await borrowBook(book.id, member.id);

    expect(created.status).toBe(201);

    const response = await request(app).patch(
      `/api/borrowings/${created.body.data.id}/return`,
    );

    expect(response.status).toBe(200);
    expect(response.body.data.returnedAt).not.toBeNull();
    expect(response.body.data.book.availableCopies).toBe(1);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(1);
  });

  test("PATCH rejects returning the same borrowing twice", async () => {
    const book = await createBook(1);
    const member = await createMember();
    const created = await borrowBook(book.id, member.id);

    expect(created.status).toBe(201);

    const firstReturn = await request(app).patch(
      `/api/borrowings/${created.body.data.id}/return`,
    );

    expect(firstReturn.status).toBe(200);

    const secondReturn = await request(app).patch(
      `/api/borrowings/${created.body.data.id}/return`,
    );

    expect(secondReturn.status).toBe(409);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(1);
  });

  test("GET rejects invalid borrowing ID", async () => {
    const response = await request(app).get("/api/borrowings/abc");

    expect(response.status).toBe(400);
  });

  test("PATCH return rejects nonexistent borrowing", async () => {
    const response = await request(app).patch(
      "/api/borrowings/2147483647/return",
    );

    expect(response.status).toBe(404);
  });

  test("Concurrent borrowing requests cannot borrow the last copy twice", async () => {
    const book = await createBook(1);
    const member1 = await createMember();
    const member2 = await createMember();

    const [response1, response2] = await Promise.all([
      borrowBook(book.id, member1.id),
      borrowBook(book.id, member2.id),
    ]);

    const statuses = [response1.status, response2.status].sort();

    expect(statuses).toEqual([201, 409]);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(0);

    const borrowings = await prisma.borrowing.findMany({
      where: { bookId: book.id },
    });

    expect(borrowings).toHaveLength(1);
  });

  test("Concurrent returns cannot restore the same copy twice", async () => {
    const book = await createBook(1);
    const member = await createMember();

    const created = await borrowBook(book.id, member.id);
    expect(created.status).toBe(201);

    const borrowingId = created.body.data.id;

    const [response1, response2] = await Promise.all([
      request(app).patch(`/api/borrowings/${borrowingId}/return`),
      request(app).patch(`/api/borrowings/${borrowingId}/return`),
    ]);

    const statuses = [response1.status, response2.status].sort();

    expect(statuses).toEqual([200, 409]);

    const updatedBook = await prisma.book.findUnique({
      where: { id: book.id },
    });

    expect(updatedBook.availableCopies).toBe(1);

    const borrowing = await prisma.borrowing.findUnique({
      where: { id: borrowingId },
    });

    expect(borrowing.returnedAt).not.toBeNull();
  });
});
