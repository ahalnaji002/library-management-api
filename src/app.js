const express = require("express");

const requestLogger = require("./middlewares/requestLogger");
const notFound = require("./middlewares/notFound");
const errorHandler = require("./middlewares/errorHandler");
const bookRoutes = require("./routes/bookRoutes");
const memberRoutes = require("./routes/memberRoutes");
const borrowingRoutes = require("./routes/borrowingRoutes");

const app = express();

app.use(requestLogger);
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Library Management API is running",
  });
});

app.use("/api/books", bookRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/borrowings", borrowingRoutes);

// Must be registered after all routes.
app.use(notFound);

// Must be the last middleware.
app.use(errorHandler);

module.exports = app;
