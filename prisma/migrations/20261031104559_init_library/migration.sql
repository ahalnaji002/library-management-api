-- CreateTable
CREATE TABLE "Book" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT NOT NULL,
    "totalCopies" INTEGER NOT NULL,
    "availableCopies" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Borrowing" (
    "id" SERIAL NOT NULL,
    "bookId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Borrowing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Book_isbn_key" ON "Book"("isbn");

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- AddForeignKey
ALTER TABLE "Borrowing" ADD CONSTRAINT "Borrowing_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Borrowing" ADD CONSTRAINT "Borrowing_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure that every book has at least one copy
ALTER TABLE "Book"
ADD CONSTRAINT "Book_totalCopies_check"
CHECK ("totalCopies" >= 1);

-- Prevent negative available copies
ALTER TABLE "Book"
ADD CONSTRAINT "Book_availableCopies_nonnegative_check"
CHECK ("availableCopies" >= 0);

-- Available copies cannot exceed total copies
ALTER TABLE "Book"
ADD CONSTRAINT "Book_availableCopies_max_check"
CHECK ("availableCopies" <= "totalCopies");

-- Due date must be later than borrowing date
ALTER TABLE "Borrowing"
ADD CONSTRAINT "Borrowing_dueAt_check"
CHECK ("dueAt" > "borrowedAt");

-- Return date cannot be earlier than borrowing date
ALTER TABLE "Borrowing"
ADD CONSTRAINT "Borrowing_returnedAt_check"
CHECK ("returnedAt" IS NULL OR "returnedAt" >= "borrowedAt");