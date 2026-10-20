ALTER TABLE "User"
  ADD COLUMN "phoneNumber" VARCHAR(16),
  ADD COLUMN "photoBytes" BYTEA,
  ADD COLUMN "photoMimeType" TEXT,
  ADD COLUMN "photoVersion" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumber_format"
  CHECK ("phoneNumber" IS NULL OR "phoneNumber" ~ '^\+[1-9][0-9]{6,14}$');
ALTER TABLE "User" ADD CONSTRAINT "User_photo_bounds"
  CHECK (("photoBytes" IS NULL AND "photoMimeType" IS NULL) OR
    (octet_length("photoBytes") BETWEEN 1 AND 2097152 AND "photoMimeType" IN ('image/jpeg', 'image/png', 'image/webp')));
