/** Explicit, restartable migration of existing database bytes. Source bytes clear only after a stored-object write succeeds. */
import { prisma } from "./lib/prisma.js";
import { checkStorage, storeObject, readObject } from "./lib/storage.js";
import { logServerError } from "./lib/telemetry.js";

async function main() {
  await checkStorage();
  let count = 0;
  for (;;) {
    const assets = await prisma.mediaAsset.findMany({
      where: { bytes: { not: null }, storageKey: null },
      take: 10,
    });
    if (!assets.length) break;
    for (const asset of assets) {
      const storageKey = await storeObject(
        Buffer.from(asset.bytes!),
        asset.mimeType,
      );
      if (!(await readObject(storageKey)).equals(Buffer.from(asset.bytes!)))
        throw new Error(
          "Stored media verification failed; database bytes retained",
        );
      const updated = await prisma.mediaAsset.updateMany({
        where: { id: asset.id, storageKey: null },
        data: { storageKey, bytes: null },
      });
      count += updated.count;
    }
  }
  for (;;) {
    const profiles = await prisma.user.findMany({
      where: { photoBytes: { not: null }, photoStorageKey: null },
      select: {
        id: true,
        photoBytes: true,
        photoMimeType: true,
        photoVersion: true,
      },
      take: 10,
    });
    if (!profiles.length) break;
    for (const profile of profiles) {
      const photoStorageKey = await storeObject(
        Buffer.from(profile.photoBytes!),
        profile.photoMimeType!,
      );
      if (
        !(await readObject(photoStorageKey)).equals(
          Buffer.from(profile.photoBytes!),
        )
      )
        throw new Error(
          "Stored photo verification failed; database bytes retained",
        );
      const updated = await prisma.user.updateMany({
        where: {
          id: profile.id,
          photoVersion: profile.photoVersion,
          photoStorageKey: null,
          photoBytes: { not: null },
        },
        data: { photoStorageKey, photoBytes: null },
      });
      count += updated.count;
    }
  }
  console.info(`Moved ${count} media records to private object storage`);
}
main()
  .catch((error) => {
    logServerError("media_migration_error", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
