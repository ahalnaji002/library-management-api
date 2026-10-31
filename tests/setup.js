const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for tests");
}

let parsedUrl;

try {
  parsedUrl = new URL(databaseUrl);
} catch {
  throw new Error("Invalid test DATABASE_URL");
}

if (
  process.env.NODE_ENV !== "test" ||
  !["postgresql:", "postgres:"].includes(parsedUrl.protocol) ||
  parsedUrl.pathname !== "/library_test"
) {
  throw new Error(
    "Tests must run with NODE_ENV=test and database library_test",
  );
}
