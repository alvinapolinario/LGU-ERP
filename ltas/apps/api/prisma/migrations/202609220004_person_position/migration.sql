ALTER TABLE `persons` ADD COLUMN `positionCode` VARCHAR(32) NOT NULL DEFAULT 'OTHER';
CREATE INDEX `persons_municipalityId_positionCode_idx` ON `persons`(`municipalityId`, `positionCode`);
