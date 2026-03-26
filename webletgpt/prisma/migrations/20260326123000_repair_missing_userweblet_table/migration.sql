CREATE TABLE IF NOT EXISTS "UserWeblet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "webletId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserWeblet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UserWeblet_userId_idx" ON "UserWeblet"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserWeblet_userId_webletId_key" ON "UserWeblet"("userId", "webletId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'UserWeblet_userId_fkey'
    ) THEN
        ALTER TABLE "UserWeblet"
            ADD CONSTRAINT "UserWeblet_userId_fkey"
            FOREIGN KEY ("userId")
            REFERENCES "User"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'UserWeblet_webletId_fkey'
    ) THEN
        ALTER TABLE "UserWeblet"
            ADD CONSTRAINT "UserWeblet_webletId_fkey"
            FOREIGN KEY ("webletId")
            REFERENCES "Weblet"("id")
            ON DELETE CASCADE
            ON UPDATE CASCADE;
    END IF;
END
$$;
