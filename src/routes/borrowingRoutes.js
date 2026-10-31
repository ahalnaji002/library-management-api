const express = require("express");
const borrowingController = require("../controllers/borrowingController");

const router = express.Router();

router.get("/", borrowingController.getAllBorrowings);

router.get("/member/:memberId", borrowingController.getBorrowingsByMember);

router.get("/:id", borrowingController.getBorrowingById);

router.post("/", borrowingController.createBorrowing);

router.patch("/:id/return", borrowingController.returnBorrowing);

module.exports = router;
