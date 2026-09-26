-- CreateEnum
CREATE TYPE "MovementReason" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('PURCHASE', 'SALE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('NOT_SENT', 'SENT', 'POSTED');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "invoiceId" UUID,
ADD COLUMN     "reason" "MovementReason" NOT NULL DEFAULT 'ADJUSTMENT';

-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "invoiceNumber" VARCHAR(32) NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'NOT_SENT',
    "counterpartyName" VARCHAR(120) NOT NULL,
    "date" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,4) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "productId" UUID NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "sku" VARCHAR(32) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" UUID NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_type_status_idx" ON "Invoice"("type", "status");

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

-- CreateIndex
CREATE INDEX "InvoiceLine_productId_idx" ON "InvoiceLine"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_invoiceId_lineNumber_key" ON "InvoiceLine"("invoiceId", "lineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceSequence_type_year_key" ON "InvoiceSequence"("type", "year");

-- CreateIndex
CREATE INDEX "StockMovement_invoiceId_idx" ON "StockMovement"("invoiceId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Hand-written: Prisma schema cannot express CHECK constraints.
-- They encode the accounting invariants in the database itself, so even a bug
-- in application code (or a manual write) cannot produce an inconsistent invoice.

-- Invoice lines: positive quantity, non-negative money, and line math that adds up.
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_unitPrice_non_negative" CHECK ("unitPrice" >= 0);
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_lineTotal_matches" CHECK ("lineTotal" = "quantity" * "unitPrice");
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_lineNumber_positive" CHECK ("lineNumber" >= 1);

-- Invoice totals: non-negative, total = subtotal + tax, sane tax rate and dates.
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_total_non_negative" CHECK ("total" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subtotal_non_negative" CHECK ("subtotal" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_taxAmount_non_negative" CHECK ("taxAmount" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_total_matches" CHECK ("total" = "subtotal" + "taxAmount");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_taxRate_range" CHECK ("taxRate" >= 0 AND "taxRate" < 1);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_dueDate_not_before_date" CHECK ("dueDate" >= "date");

ALTER TABLE "InvoiceSequence" ADD CONSTRAINT "InvoiceSequence_lastNumber_non_negative" CHECK ("lastNumber" >= 0);

-- Ledger consistency: purchases and sales always carry their invoice, adjustments
-- never do; and a purchase can only add stock, a sale can only remove it.
-- Existing rows (reason defaults to ADJUSTMENT, invoiceId NULL) already satisfy these.
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_invoice_matches_reason"
  CHECK (("reason" = 'ADJUSTMENT') = ("invoiceId" IS NULL));
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_type_matches_reason"
  CHECK (("reason" <> 'PURCHASE' OR "type" = 'IN') AND ("reason" <> 'SALE' OR "type" = 'OUT'));
