const prisma = require("../config/prisma");
const AppError = require("../utils/AppError");

async function getAllBorrowings() {
  return prisma.borrowing.findMany({
    include: {
      book: true,
      member: true,
    },
    orderBy: { id: "asc" },
  });
}

async function getBorrowingById(id) {
  return prisma.borrowing.findUnique({
    where: { id },
    include: {
      book: true,
      member: true,
    },
  });
}

async function getBorrowingsByMember(memberId) {
  return prisma.borrowing.findMany({
    where: { memberId },
    include: {
      book: true,
      member: true,
    },
    orderBy: { id: "asc" },
  });
}

async function createBorrowing({ bookId, memberId, dueAt }) {
  try {
    return await prisma.$transaction(async (tx) => {
      const books = await tx.$queryRaw`
        SELECT "id", "availableCopies"
        FROM "Book"
        WHERE "id" = ${bookId}
        FOR UPDATE
      `;

      const book = books[0];

      if (!book) {
        throw new AppError("Book not found", 404);
      }

      const member = await tx.member.findUnique({
        where: { id: memberId },
      });

      if (!member) {
        throw new AppError("Member not found", 404);
      }

      if (book.availableCopies < 1) {
        throw new AppError("No available copies", 409);
      }

      const borrowing = await tx.borrowing.create({
        data: {
          bookId,
          memberId,
          dueAt,
        },
      });

      await tx.book.update({
        where: { id: bookId },
        data: {
          availableCopies: { decrement: 1 },
        },
      });

      return tx.borrowing.findUnique({
        where: { id: borrowing.id },
        include: {
          book: true,
          member: true,
        },
      });
    });
  } catch (error) {
    const foreignKey =
      error.meta?.field_name ??
      error.meta?.driverAdapterError?.cause?.constraint?.index;

    if (
      error.code === "P2003" &&
      (foreignKey === "Borrowing_memberId_fkey" ||
        foreignKey === "Borrowing_memberId_fkey (index)")
    ) {
      throw new AppError("Member not found", 404);
    }

    throw error;
  }
}

async function returnBorrowing(id) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT "id", "bookId", "returnedAt"
      FROM "Borrowing"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const borrowing = rows[0];

    if (!borrowing) {
      throw new AppError("Borrowing not found", 404);
    }

    if (borrowing.returnedAt !== null) {
      throw new AppError("Book already returned", 409);
    }

    await tx.borrowing.update({
      where: { id },
      data: { returnedAt: new Date() },
    });

    await tx.book.update({
      where: { id: borrowing.bookId },
      data: {
        availableCopies: { increment: 1 },
      },
    });

    return tx.borrowing.findUnique({
      where: { id },
      include: {
        book: true,
        member: true,
      },
    });
  });
}

module.exports = {
  getAllBorrowings,
  getBorrowingById,
  getBorrowingsByMember,
  createBorrowing,
  returnBorrowing,
};
