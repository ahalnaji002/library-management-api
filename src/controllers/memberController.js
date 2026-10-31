const memberService = require("../services/memberService");
const AppError = require("../utils/AppError");

function parseMemberId(value) {
  if (!/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id > 2147483647) {
    return null;
  }

  return id;
}

function isValidName(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(value) {
  return (
    typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

async function getAllMembers(req, res, next) {
  try {
    const members = await memberService.getAllMembers();

    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    next(error);
  }
}

async function getMemberById(req, res, next) {
  try {
    const id = parseMemberId(req.params.id);

    if (id === null) {
      throw new AppError("Invalid member ID", 400);
    }

    const member = await memberService.getMemberById(id);

    if (!member) {
      throw new AppError("Member not found", 404);
    }

    res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    next(error);
  }
}

async function createMember(req, res, next) {
  try {
    const data = req.body ?? {};
    const allowedFields = ["name", "email"];

    if (Object.keys(data).some((field) => !allowedFields.includes(field))) {
      throw new AppError("Invalid member data", 400);
    }

    const { name, email } = data;

    if (!isValidName(name) || !isValidEmail(email)) {
      throw new AppError("Invalid member data", 400);
    }

    const member = await memberService.createMember({
      name: name.trim(),
      email: email.trim(),
    });

    res.status(201).json({
      success: true,
      data: member,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return next(new AppError("A member with this email already exists", 409));
    }

    next(error);
  }
}

async function updateMember(req, res, next) {
  try {
    const id = parseMemberId(req.params.id);

    if (id === null) {
      throw new AppError("Invalid member ID", 400);
    }

    const data = req.body;

    if (
      !data ||
      typeof data !== "object" ||
      Array.isArray(data) ||
      Object.keys(data).length === 0
    ) {
      throw new AppError("Invalid member data", 400);
    }

    const allowedFields = ["name", "email"];

    if (Object.keys(data).some((key) => !allowedFields.includes(key))) {
      throw new AppError("Invalid member data", 400);
    }

    if (
      (data.name !== undefined && !isValidName(data.name)) ||
      (data.email !== undefined && !isValidEmail(data.email))
    ) {
      throw new AppError("Invalid member data", 400);
    }

    const updateData = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }

    if (data.email !== undefined) {
      updateData.email = data.email.trim();
    }

    const member = await memberService.updateMember(id, updateData);

    res.status(200).json({
      success: true,
      data: member,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return next(new AppError("Member not found", 404));
    }

    if (error.code === "P2002") {
      return next(new AppError("A member with this email already exists", 409));
    }

    next(error);
  }
}

async function deleteMember(req, res, next) {
  try {
    const id = parseMemberId(req.params.id);

    if (id === null) {
      throw new AppError("Invalid member ID", 400);
    }

    await memberService.deleteMember(id);

    res.status(204).send();
  } catch (error) {
    if (error.code === "P2025") {
      return next(new AppError("Member not found", 404));
    }

    if (error.code === "P2003") {
      return next(
        new AppError("Cannot delete a member with borrowing history", 409),
      );
    }

    next(error);
  }
}

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
};
