const express = require("express");
const bookController = require("../controllers/bookController");

const router = express.Router();

router.get("/", bookController.getAllBooks);
router.get("/:id", bookController.getBookById);
router.post("/", bookController.createBook);
router.patch("/:id", bookController.updateBook);
router.delete("/:id", bookController.deleteBook);

module.exports = router;
