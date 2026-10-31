const borrowingService = require("../services/borrowingService");
const AppError = require("../utils/AppError");

function parsePositiveId(value) {
  const text = String(value);

  if (!/^[1-9]\d*$/.test(text)) {
    return null;
  }

  const id = Number(text);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    return null;
  }

  return id;
}

async function getAllBorrowings(req, res, next) {
  try {
    const borrowings = await borrowingService.getAllBorrowings();

    res.status(200).json({
      success: true,
      data: borrowings,
    });
  } catch (error) {
    next(error);
  }
}

async function getBorrowingById(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);

    if (id === null) {
      throw new AppError("Invalid borrowing ID", 400);
    }

    const borrowing = await borrowingService.getBorrowingById(id);

    if (!borrowing) {
      throw new AppError("Borrowing not found", 404);
    }

    res.status(200).json({
      success: true,
      data: borrowing,
    });
  } catch (error) {
    next(error);
  }
}

async function getBorrowingsByMember(req, res, next) {
  try {
    const memberId = parsePositiveId(req.params.memberId);

    if (memberId === null) {
      throw new AppError("Invalid member ID", 400);
    }

    const borrowings = await borrowingService.getBorrowingsByMember(memberId);

    res.status(200).json({
      success: true,
      data: borrowings,
    });
  } catch (error) {
    next(error);
  }
}

async function createBorrowing(req, res, next) {
  try {
    const data = req.body;

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new AppError("Invalid borrowing data", 400);
    }

    const allowedFields = ["bookId", "memberId", "dueAt"];

    if (Object.keys(data).some((key) => !allowedFields.includes(key))) {
      throw new AppError("Invalid borrowing data", 400);
    }

    const { bookId, memberId, dueAt } = data;

    const parsedBookId = parsePositiveId(bookId);
    const parsedMemberId = parsePositiveId(memberId);

    if (parsedBookId === null || parsedMemberId === null) {
      throw new AppError("Invalid book or member ID", 400);
    }

    if (typeof dueAt !== "string") {
      throw new AppError("Invalid due date", 400);
    }

    // Require an ISO 8601 timestamp with an explicit timezone.
    const isoDatePattern =
      /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

    const dateParts = dueAt.match(isoDatePattern);

    if (!dateParts) {
      throw new AppError("Invalid due date", 400);
    }

    const year = Number(dateParts[1]);
    const month = Number(dateParts[2]);
    const day = Number(dateParts[3]);
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const daysInMonth = [
      31,
      isLeapYear ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];

    if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
      throw new AppError("Invalid due date", 400);
    }

    const parsedDueAt = new Date(dueAt);

    if (Number.isNaN(parsedDueAt.getTime()) || parsedDueAt <= new Date()) {
      throw new AppError("Due date must be in the future", 400);
    }

    const borrowing = await borrowingService.createBorrowing({
      bookId: parsedBookId,
      memberId: parsedMemberId,
      dueAt: parsedDueAt,
    });

    res.status(201).json({
      success: true,
      data: borrowing,
    });
  } catch (error) {
    next(error);
  }
}

async function returnBorrowing(req, res, next) {
  try {
    const id = parsePositiveId(req.params.id);

    if (id === null) {
      throw new AppError("Invalid borrowing ID", 400);
    }

    const borrowing = await borrowingService.returnBorrowing(id);

    res.status(200).json({
      success: true,
      data: borrowing,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllBorrowings,
  getBorrowingById,
  getBorrowingsByMember,
  createBorrowing,
  returnBorrowing,
};
