-- AlterTable
ALTER TABLE "public"."digest_config" ADD COLUMN     "days_of_week" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];
