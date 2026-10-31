const prisma = require("../config/prisma");

async function getAllMembers() {
  return prisma.member.findMany({
    orderBy: { id: "asc" },
  });
}

async function getMemberById(id) {
  return prisma.member.findUnique({
    where: { id },
  });
}

async function createMember(data) {
  return prisma.member.create({
    data: {
      name: data.name,
      email: data.email,
    },
  });
}

async function updateMember(id, data) {
  return prisma.member.update({
    where: { id },
    data,
  });
}

async function deleteMember(id) {
  return prisma.member.delete({
    where: { id },
  });
}

module.exports = {
  getAllMembers,
  getMemberById,
  createMember,
  updateMember,
  deleteMember,
};
