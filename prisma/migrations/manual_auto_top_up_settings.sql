-- Manual migration for AutoTopUpSettings table
-- Run this SQL directly in your database

CREATE TABLE IF NOT EXISTS "auto_top_up_settings" (
    "id" TEXT NOT NULL,
    "triggerThreshold" INTEGER NOT NULL DEFAULT 200,
    "topUpPlanId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auto_top_up_settings_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'auto_top_up_settings_topUpPlanId_fkey'
    ) THEN
        ALTER TABLE "auto_top_up_settings" 
        ADD CONSTRAINT "auto_top_up_settings_topUpPlanId_fkey" 
        FOREIGN KEY ("topUpPlanId") 
        REFERENCES "top_up_plans"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

-- Create index for active settings lookup
CREATE INDEX IF NOT EXISTS "auto_top_up_settings_isActive_idx" 
ON "auto_top_up_settings"("isActive");

-- Add relation to top_up_plans table (already exists, just ensure it's correct)
-- The relation is handled by Prisma, this is just for reference

