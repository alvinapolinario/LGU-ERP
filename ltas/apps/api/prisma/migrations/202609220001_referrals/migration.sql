-- CreateTable
CREATE TABLE `committee_referrals` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `measureVersionId` CHAR(36) NOT NULL,
    `committeeId` CHAR(36) NOT NULL,
    `groupId` CHAR(36) NOT NULL,
    `referralSequence` INTEGER NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `sourceKind` VARCHAR(40) NOT NULL,
    `referredOn` DATE NOT NULL,
    `dueOn` DATE NULL,
    `disposition` VARCHAR(20) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `closedBy` CHAR(36) NULL,
    `closeReason` VARCHAR(500) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `committee_referrals_measureId_committeeId_referralSequence_key`(`measureId`, `committeeId`, `referralSequence`),
    INDEX `committee_referrals_committeeId_disposition_dueOn_idx`(`committeeId`, `disposition`, `dueOn`),
    INDEX `committee_referrals_municipalityId_groupId_idx`(`municipalityId`, `groupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `committee_referrals` ADD CONSTRAINT `committee_referrals_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_referrals` ADD CONSTRAINT `committee_referrals_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_referrals` ADD CONSTRAINT `committee_referrals_measureVersionId_fkey` FOREIGN KEY (`measureVersionId`) REFERENCES `measure_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_referrals` ADD CONSTRAINT `committee_referrals_committeeId_municipalityId_fkey` FOREIGN KEY (`committeeId`, `municipalityId`) REFERENCES `committees`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;
