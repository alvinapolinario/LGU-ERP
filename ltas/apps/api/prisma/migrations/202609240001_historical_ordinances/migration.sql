CREATE TABLE `historical_ordinances` (
  `id` CHAR(36) NOT NULL,
  `municipalityId` CHAR(36) NOT NULL,
  `termId` CHAR(36) NOT NULL,
  `title` VARCHAR(240) NOT NULL,
  `officialYear` INTEGER NULL,
  `officialNumber` VARCHAR(40) NULL,
  `sourceNote` VARCHAR(500) NOT NULL,
  `scanMime` VARCHAR(40) NULL,
  `scanSha256` CHAR(64) NULL,
  `scanFilename` VARCHAR(200) NULL,
  `scanBytes` MEDIUMBLOB NULL,
  `extractedText` TEXT NULL,
  `extractState` VARCHAR(20) NOT NULL DEFAULT 'NONE',
  `extractNote` VARCHAR(240) NULL,
  `revision` INTEGER NOT NULL DEFAULT 1,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `historical_ordinances_municipalityId_termId_idx`(`municipalityId`, `termId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `historical_ordinances` ADD CONSTRAINT `historical_ordinances_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `historical_ordinances` ADD CONSTRAINT `historical_ordinances_termId_municipalityId_fkey` FOREIGN KEY (`termId`, `municipalityId`) REFERENCES `council_terms`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;
