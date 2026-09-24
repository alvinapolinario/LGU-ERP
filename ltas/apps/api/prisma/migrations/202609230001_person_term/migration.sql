ALTER TABLE `persons` ADD COLUMN `termId` CHAR(36) NULL;
ALTER TABLE `persons` ADD COLUMN `revision` INTEGER NOT NULL DEFAULT 1;

UPDATE `persons` AS `person`
SET `termId` = (
  SELECT `term`.`id` FROM `council_terms` AS `term`
  WHERE `term`.`municipalityId` = `person`.`municipalityId`
  ORDER BY `term`.`startsOn` DESC, `term`.`id` ASC
  LIMIT 1
)
WHERE `person`.`termId` IS NULL;

ALTER TABLE `persons` MODIFY `termId` CHAR(36) NOT NULL;
CREATE INDEX `persons_municipalityId_termId_idx` ON `persons`(`municipalityId`, `termId`);
ALTER TABLE `persons` ADD CONSTRAINT `persons_termId_municipalityId_fkey` FOREIGN KEY (`termId`, `municipalityId`) REFERENCES `council_terms`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;
