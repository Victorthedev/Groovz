-- CreateTable
CREATE TABLE "TasteProfile" (
    "userId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "signalCount" INTEGER NOT NULL,
    "mlStage" INTEGER NOT NULL,
    "energyCentroid" DOUBLE PRECISION NOT NULL,
    "tempoCentroid" DOUBLE PRECISION NOT NULL,
    "noveltyTolerance" DOUBLE PRECISION NOT NULL,
    "genreAffinities" JSONB NOT NULL,
    "artistAffinities" JSONB NOT NULL,
    "tagAffinities" JSONB NOT NULL,
    "temporalPatterns" JSONB,
    "currentPhase" JSONB NOT NULL,

    CONSTRAINT "TasteProfile_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "TasteProfile" ADD CONSTRAINT "TasteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
