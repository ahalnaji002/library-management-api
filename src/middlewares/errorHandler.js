function errorHandler(err, req, res, next) {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: {
        message: "Malformed JSON request body",
      },
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      error: {
        message: "Request body is too large",
      },
    });
  }

  const isOperational = err.isOperational === true;

  const statusCode = isOperational ? err.statusCode : 500;
  const message = isOperational ? err.message : "Internal Server Error";

  if (!isOperational) {
    console.error("Unexpected error:", err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message,
    },
  });
}

module.exports = errorHandler;
