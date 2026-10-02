-- AlterTable: Add keyPrefix with a temporary default for existing rows.
-- Existing rows get 'legacy' as prefix — they will never match real requests
-- (real prefixes are 8 hex chars). New rows always get the real prefix set by the app.
ALTER TABLE "ApiKey" ADD COLUMN "keyPrefix" TEXT NOT NULL DEFAULT 'legacy';
-- Remove the default so future inserts must supply a value explicitly.
ALTER TABLE "ApiKey" ALTER COLUMN "keyPrefix" DROP DEFAULT;

