CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");
ALTER TABLE "User" DROP CONSTRAINT "User_photo_bounds";
ALTER TABLE "User" ADD CONSTRAINT "User_photo_bounds"
  CHECK (("photoBytes" IS NULL AND "photoMimeType" IS NULL) OR
    ("photoBytes" IS NOT NULL AND "photoMimeType" IS NOT NULL AND
     octet_length("photoBytes") BETWEEN 1 AND 2097152 AND
     "photoMimeType" IN ('image/jpeg', 'image/png', 'image/webp')));
