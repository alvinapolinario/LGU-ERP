-- CreateTable
CREATE TABLE `committee_meetings` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `committeeId` CHAR(36) NOT NULL,
    `reference` VARCHAR(30) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `venue` VARCHAR(160) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `state` VARCHAR(20) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `closedBy` CHAR(36) NULL,
    `closeReason` VARCHAR(500) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `committee_meetings_committeeId_reference_key`(`committeeId`, `reference`),
    INDEX `committee_meetings_committeeId_scheduledAt_idx`(`committeeId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `meeting_referrals` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `meetingId` CHAR(36) NOT NULL,
    `referralId` CHAR(36) NOT NULL,
    `measureVersionId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `meeting_referrals_meetingId_referralId_key`(`meetingId`, `referralId`),
    UNIQUE INDEX `meeting_referrals_meetingId_sequence_key`(`meetingId`, `sequence`),
    INDEX `meeting_referrals_referralId_idx`(`referralId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `committee_meetings` ADD CONSTRAINT `committee_meetings_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_meetings` ADD CONSTRAINT `committee_meetings_committeeId_municipalityId_fkey` FOREIGN KEY (`committeeId`, `municipalityId`) REFERENCES `committees`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meeting_referrals` ADD CONSTRAINT `meeting_referrals_meetingId_fkey` FOREIGN KEY (`meetingId`) REFERENCES `committee_meetings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `meeting_referrals` ADD CONSTRAINT `meeting_referrals_referralId_fkey` FOREIGN KEY (`referralId`) REFERENCES `committee_referrals`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
