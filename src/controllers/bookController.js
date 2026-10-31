const bookService = require("../services/bookService");
const AppError = require("../utils/AppError");

async function getAllBooks(req, res) {
  const books = await bookService.getAllBooks();

  res.status(200).json({
    success: true,
    data: books,
  });
}

async function getBookById(req, res) {
  const rawId = req.params.id;
  const id = Number(rawId);

  if (
    !/^[1-9]\d*$/.test(rawId) ||
    !Number.isSafeInteger(id) ||
    id > 2147483647
  ) {
    throw new AppError("Invalid book ID", 400);
  }

  const book = await bookService.getBookById(id);

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  res.status(200).json({
    success: true,
    data: book,
  });
}

async function createBook(req, res) {
  const data = req.body ?? {};
  const allowedFields = ["title", "author", "isbn", "totalCopies"];

  if (Object.keys(data).some((field) => !allowedFields.includes(field))) {
    throw new AppError("Invalid book data", 400);
  }

  const { title, author, isbn, totalCopies } = data;

  const isValidText = (value) =>
    typeof value === "string" && value.trim().length > 0;

  if (
    !isValidText(title) ||
    !isValidText(author) ||
    !isValidText(isbn) ||
    !Number.isInteger(totalCopies) ||
    totalCopies < 1 ||
    totalCopies > 2147483647
  ) {
    throw new AppError("Invalid book data", 400);
  }

  let book;

  try {
    book = await bookService.createBook({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim(),
      totalCopies,
    });
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("A book with this ISBN already exists", 409);
    }

    throw error;
  }

  res.status(201).json({
    success: true,
    data: book,
  });
}

async function updateBook(req, res) {
  const rawId = req.params.id;
  const id = Number(rawId);

  if (
    !/^[1-9]\d*$/.test(rawId) ||
    !Number.isSafeInteger(id) ||
    id > 2147483647
  ) {
    throw new AppError("Invalid book ID", 400);
  }

  const data = req.body;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("Invalid book data", 400);
  }

  const allowedFields = ["title", "author", "isbn", "totalCopies"];

  const fields = Object.keys(data);

  if (
    fields.length === 0 ||
    fields.some((field) => !allowedFields.includes(field))
  ) {
    throw new AppError("Invalid book data", 400);
  }

  const updateData = {};

  for (const field of fields) {
    const value = data[field];

    if (field === "totalCopies") {
      if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
        throw new AppError("Invalid book data", 400);
      }

      updateData[field] = value;
    } else {
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new AppError("Invalid book data", 400);
      }

      updateData[field] = value.trim();
    }
  }

  let book;

  try {
    book = await bookService.updateBook(id, updateData);
  } catch (error) {
    if (error.code === "P2002") {
      throw new AppError("A book with this ISBN already exists", 409);
    }

    throw error;
  }

  if (!book) {
    throw new AppError("Book not found", 404);
  }

  if (book.conflict === true) {
    throw new AppError("Total copies cannot be less than borrowed copies", 409);
  }

  res.status(200).json({
    success: true,
    data: book,
  });
}

async function deleteBook(req, res) {
  const rawId = req.params.id;
  const id = Number(rawId);

  if (
    !/^[1-9]\d*$/.test(rawId) ||
    !Number.isSafeInteger(id) ||
    id > 2147483647
  ) {
    throw new AppError("Invalid book ID", 400);
  }

  try {
    await bookService.deleteBook(id);
  } catch (error) {
    if (error.code === "P2025") {
      throw new AppError("Book not found", 404);
    }

    if (error.code === "P2003") {
      throw new AppError("Cannot delete a book with borrowing history", 409);
    }

    throw error;
  }

  res.status(204).send();
}

module.exports = {
  getAllBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
};
