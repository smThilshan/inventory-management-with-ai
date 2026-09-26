-- Snapshot of our company details on each invoice (like the line snapshots), so a
-- PDF regenerated later still shows the issuer's name/address as they were on the day.
--
-- Safe on a table that already has rows: add nullable, backfill, then enforce NOT NULL.
-- Invoices issued before this migration never recorded the issuer, and SQL cannot
-- read the app config, so they are marked explicitly rather than guessed.
ALTER TABLE "Invoice" ADD COLUMN "companyName" VARCHAR(255),
                      ADD COLUMN "companyAddress" VARCHAR(255);

UPDATE "Invoice"
SET "companyName" = '(not recorded)', "companyAddress" = '(not recorded)'
WHERE "companyName" IS NULL;

ALTER TABLE "Invoice" ALTER COLUMN "companyName" SET NOT NULL,
                      ALTER COLUMN "companyAddress" SET NOT NULL;
