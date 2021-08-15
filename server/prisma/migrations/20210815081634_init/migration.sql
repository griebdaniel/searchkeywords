/*
  Warnings:

  - Made the column `urls` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `keywords` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ALTER COLUMN "urls" SET NOT NULL,
ALTER COLUMN "urls" SET DEFAULT E'[]',
ALTER COLUMN "keywords" SET NOT NULL,
ALTER COLUMN "keywords" SET DEFAULT E'[]';
