-- AlterTable
ALTER TABLE "PlaylistRecord" ADD COLUMN     "narrative" TEXT;

-- AlterTable
ALTER TABLE "UserCapabilities" ALTER COLUMN "maxPlaylistsPerMonth" SET DEFAULT 999999;
