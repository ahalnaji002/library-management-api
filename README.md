# Library Management API

A REST API for managing books, library members, and borrowing/return records.
This repository covers the Phase 1 API scope: Books, Members, and Borrowings,
with PostgreSQL persistence and automated integration tests.

## Technology stack

- Node.js (Prisma 7 supports Node.js `^20.19`, `^22.12`, or `>=24.0`)
- Express 5
- PostgreSQL 17
- Prisma 7 with the PostgreSQL driver adapter
- Jest and Supertest

## Prerequisites

- A supported Node.js version and npm
- Docker Desktop or Docker Engine with the Docker Compose plugin
- A terminal in the project root

## Local setup

1. Install dependencies from the lockfile:

   ```sh
   npm ci
   ```

2. Create a local environment file and replace the example password with a
   unique local-development password. Keep the password in
   `POSTGRES_PASSWORD` and `DATABASE_URL` in sync.

   PowerShell:

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

   macOS/Linux:

   ```sh
   test -e .env || cp .env.example .env
   ```

   `.env` is ignored by Git. `DATABASE_URL` must point to the development
   database `library_dev` on the host-mapped PostgreSQL port `5433`. If `.env`
   already exists, keep it and add or update only the required Compose settings
   after checking the existing-volume guidance below. Do not replace working
   database credentials with the placeholders in `.env.example`.

3. Start PostgreSQL:

   ```sh
   docker compose up -d
   docker compose ps
   ```

4. Generate Prisma Client and apply the committed migrations to the database
   named by `DATABASE_URL`:

   ```sh
   npx prisma generate --config prisma7.config.ts
   npx prisma migrate deploy --config prisma7.config.ts
   ```

5. Start the API:

   ```sh
   npm run dev
   ```

   The server listens on port `3000` by default. Set `PORT` in `.env` to use a
   different port. The health endpoint is `GET http://localhost:3000/health`.

## Development and test databases

Use separate databases for application work and automated tests:

| Purpose | Database | Connection source |
|---|---|---|
| Local API and development migrations | `library_dev` | `.env` -> `DATABASE_URL` |
| Jest + Supertest integration tests | `library_test` | `.env.test` -> `DATABASE_URL` |

The Compose service initializes `library_dev` when it initializes an empty
data volume. PostgreSQL's image does not create `library_test` from
`POSTGRES_DB`; create the test database once on a fresh local volume. First
inspect the databases:

```sh
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -lqt'
```

If `library_test` is not listed, create it once:

```sh
docker compose exec postgres sh -c 'createdb -U "$POSTGRES_USER" library_test'
```

Create `.env.test` with `NODE_ENV=test` and a test-only `DATABASE_URL`. Use the
same local credentials as `.env`, but point the URL to `library_test`:

```dotenv
NODE_ENV=test
DATABASE_URL=postgresql://library_user:replace-with-a-unique-local-password@localhost:5433/library_test?schema=public
```

Do not point `.env.test` at `library_dev`. The Jest setup checks both
`NODE_ENV=test` and the database name before tests run. Apply the committed
migrations to the test database before the first test run:

```sh
node --env-file=.env.test ./node_modules/prisma/build/index.js migrate deploy --config prisma7.config.ts
```

Run the test suite with the existing script:

```sh
npm test
```

The script loads `.env.test` and runs Jest serially. Tests create and remove
their own fixture records; they do not reset the database.

## API endpoints

All resource endpoints are under `/api`. Successful read and create responses
use `{ "success": true, "data": ... }`. Error responses use
`{ "success": false, "error": { "message": "..." } }`. A successful delete
returns `204 No Content`.

### Books

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/books` | List books |
| GET | `/api/books/:id` | Get a book |
| POST | `/api/books` | Create a book |
| PATCH | `/api/books/:id` | Update supported book fields |
| DELETE | `/api/books/:id` | Delete a book without borrowing history |

Create body:

```json
{
  "title": "The Left Hand of Darkness",
  "author": "Ursula K. Le Guin",
  "isbn": "9780441478125",
  "totalCopies": 4
}
```

### Members

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/members` | List members |
| GET | `/api/members/:id` | Get a member |
| POST | `/api/members` | Create a member |
| PATCH | `/api/members/:id` | Update supported member fields |
| DELETE | `/api/members/:id` | Delete a member without borrowing history |

Create body:

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.test"
}
```

### Borrowings

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/borrowings` | List borrowings with book and member details |
| GET | `/api/borrowings/:id` | Get a borrowing |
| GET | `/api/borrowings/member/:memberId` | List a member's borrowings |
| POST | `/api/borrowings` | Borrow an available copy |
| PATCH | `/api/borrowings/:id/return` | Return a borrowing |

Create body (send `dueAt` as an ISO 8601 timestamp with an explicit timezone):

```json
{
  "bookId": 1,
  "memberId": 1,
  "dueAt": "2099-06-15T17:00:00.000Z"
}
```

### Main HTTP response codes

- `200 OK`: successful reads, updates, and returns
- `201 Created`: successful book, member, or borrowing creation
- `204 No Content`: successful book or member deletion
- `400 Bad Request`: invalid IDs, request fields, values, or malformed JSON
- `404 Not Found`: missing resource or route
- `409 Conflict`: duplicate ISBN/email, unavailable inventory, duplicate return,
  or deletion restricted by borrowing history
- `413 Content Too Large`: JSON request body exceeds the parser limit
- `500 Internal Server Error`: unexpected server failure

## Project structure

```text
prisma/
  migrations/       Committed PostgreSQL migrations
  schema.prisma     Prisma data model
src/
  config/           Prisma client configuration
  controllers/      Request validation and HTTP responses
  middlewares/      Logging, not-found, and error handling
  routes/           Express route declarations
  services/         Database and business operations
  utils/            Shared application error type
tests/              Jest + Supertest API integration tests
compose.yaml        Local PostgreSQL service
prisma7.config.ts   Prisma 7 schema, migration, and datasource config
```

## Local-development security assumptions

- This API has no authentication or authorization. Use it only in a trusted
  local development environment; do not expose it to an untrusted network.
- PostgreSQL is published on `127.0.0.1:5433`; the API's bind behavior may
  expose its port on the host interfaces, so keep local firewall/network
  controls appropriate for an unauthenticated development API.
- `.env` and `.env.test` contain local credentials and are ignored by Git.
  Never commit them. `.env.example` contains placeholders, not production
  credentials.
- The Compose volume persists data. Changing `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, or `POSTGRES_DB` does not change credentials or databases
  inside an already initialized volume. If upgrading from the previous Compose
  configuration, ensure the local `.env` defines `POSTGRES_USER`,
  `POSTGRES_PASSWORD`, and `POSTGRES_DB` with values matching the already-
  initialized PostgreSQL volume. Do not replace existing working credentials
  with `.env.example` placeholders: that can prevent the container from
  authenticating to the existing database, and changing these variables does
  not change credentials stored in the volume. Do not remove the volume to
  resolve a credential mismatch; inspect the local environment and resolve it
  without deleting database data.
- The PostgreSQL credentials are for local development only and must not be
  reused in a deployed environment.
