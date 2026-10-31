const prisma = require("../config/prisma");

async function getAllBooks() {
  return prisma.book.findMany({
    orderBy: {
      id: "asc",
    },
  });
}

async function getBookById(id) {
  return prisma.book.findUnique({
    where: { id },
  });
}

async function createBook(data) {
  return prisma.book.create({
    data: {
      title: data.title,
      author: data.author,
      isbn: data.isbn,
      totalCopies: data.totalCopies,
      availableCopies: data.totalCopies,
    },
  });
}

async function updateBook(id, data) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT "id", "totalCopies", "availableCopies"
      FROM "Book"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    const currentBook = rows[0];

    if (!currentBook) {
      return null;
    }

    const updateData = { ...data };

    if (data.totalCopies !== undefined) {
      const borrowedCopies =
        currentBook.totalCopies - currentBook.availableCopies;

      if (data.totalCopies < borrowedCopies) {
        return {
          conflict: true,
          borrowedCopies,
        };
      }

      updateData.availableCopies = data.totalCopies - borrowedCopies;
    }

    return tx.book.update({
      where: { id },
      data: updateData,
    });
  });
}

async function deleteBook(id) {
  return prisma.book.delete({
    where: { id },
  });
}

module.exports = {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
};
