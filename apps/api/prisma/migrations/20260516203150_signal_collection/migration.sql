-- AlterEnum
ALTER TYPE "SignalType" ADD VALUE 'context_used';

-- AlterTable
ALTER TABLE "UserPreferences" ADD COLUMN     "seenFeatureIntros" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "signalCollectionConsented" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "spotifySignalEnabled" BOOLEAN NOT NULL DEFAULT true;
