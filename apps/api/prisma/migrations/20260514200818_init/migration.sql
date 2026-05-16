-- CreateEnum
CREATE TYPE "Region" AS ENUM ('NG', 'UK', 'EU', 'US', 'CA');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('spotify', 'deezer', 'audiomack', 'youtube_music');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'paid');

-- CreateEnum
CREATE TYPE "GenerationType" AS ENUM ('seed', 'prompt', 'hybrid', 'weekly_ml');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('playlist_created', 'playlist_regenerated', 'seed_used', 'prompt_used', 'spotify_top_track', 'spotify_recent_play', 'lastfm_scrobble');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('active', 'cancelled', 'past_due');

-- CreateEnum
CREATE TYPE "CryptoNetwork" AS ENUM ('base', 'polygon');

-- CreateEnum
CREATE TYPE "CryptoStatus" AS ENUM ('active', 'expired');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" "Region" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectedPlatform" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "scopes" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectedPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "defaultPlatform" TEXT,
    "defaultDuration" INTEGER NOT NULL DEFAULT 60,
    "diversityBias" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "whatsappLinked" BOOLEAN NOT NULL DEFAULT false,
    "whatsappPhone" TEXT,

    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserCapabilities" (
    "userId" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "maxPlaylistDurationMinutes" INTEGER NOT NULL DEFAULT 120,
    "maxPlaylistsPerMonth" INTEGER NOT NULL DEFAULT 10,
    "playlistsGeneratedThisMonth" INTEGER NOT NULL DEFAULT 0,
    "canUseRouteFeature" BOOLEAN NOT NULL DEFAULT false,
    "canUseWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "resetDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCapabilities_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "PlaylistRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "generationType" "GenerationType" NOT NULL,
    "seedTrackTitle" TEXT,
    "seedTrackArtist" TEXT,
    "promptSummary" TEXT,
    "durationMinutes" INTEGER NOT NULL,
    "trackCount" INTEGER NOT NULL,
    "platformPlaylistId" TEXT,
    "platformPlaylistUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlaylistRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSignal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalType" "SignalType" NOT NULL,
    "data" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripePriceId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "region" TEXT NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CryptoSubscription" (
    "userId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "network" "CryptoNetwork" NOT NULL,
    "status" "CryptoStatus" NOT NULL,
    "lastChargedAt" TIMESTAMP(3) NOT NULL,
    "nextChargeAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoSubscription_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectedPlatform_userId_platform_key" ON "ConnectedPlatform"("userId", "platform");

-- CreateIndex
CREATE INDEX "PlaylistRecord_userId_idx" ON "PlaylistRecord"("userId");

-- CreateIndex
CREATE INDEX "PlaylistRecord_createdAt_idx" ON "PlaylistRecord"("createdAt");

-- CreateIndex
CREATE INDEX "UserSignal_userId_idx" ON "UserSignal"("userId");

-- CreateIndex
CREATE INDEX "UserSignal_recordedAt_idx" ON "UserSignal"("recordedAt");

-- AddForeignKey
ALTER TABLE "ConnectedPlatform" ADD CONSTRAINT "ConnectedPlatform_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCapabilities" ADD CONSTRAINT "UserCapabilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlaylistRecord" ADD CONSTRAINT "PlaylistRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSignal" ADD CONSTRAINT "UserSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoSubscription" ADD CONSTRAINT "CryptoSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
