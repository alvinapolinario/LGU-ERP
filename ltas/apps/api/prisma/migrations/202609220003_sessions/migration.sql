-- CreateTable
CREATE TABLE `legislative_sessions` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `termId` CHAR(36) NOT NULL,
    `reference` VARCHAR(30) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `venue` VARCHAR(160) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `state` VARCHAR(20) NOT NULL,
    `closedAt` DATETIME(3) NULL,
    `closedBy` CHAR(36) NULL,
    `closeReason` VARCHAR(500) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `legislative_sessions_municipalityId_reference_key`(`municipalityId`, `reference`),
    INDEX `legislative_sessions_municipalityId_scheduledAt_idx`(`municipalityId`, `scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_agenda_items` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `measureVersionId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `session_agenda_items_sessionId_measureId_key`(`sessionId`, `measureId`),
    UNIQUE INDEX `session_agenda_items_sessionId_sequence_key`(`sessionId`, `sequence`),
    INDEX `session_agenda_items_measureId_idx`(`measureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_attendance` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `personId` CHAR(36) NOT NULL,
    `disposition` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `session_attendance_sessionId_personId_key`(`sessionId`, `personId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `session_votes` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `measureVersionId` CHAR(36) NOT NULL,
    `yesCount` INTEGER NOT NULL,
    `noCount` INTEGER NOT NULL,
    `abstainCount` INTEGER NOT NULL,
    `result` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `session_votes_sessionId_measureId_key`(`sessionId`, `measureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `legislative_sessions` ADD CONSTRAINT `legislative_sessions_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `legislative_sessions` ADD CONSTRAINT `legislative_sessions_termId_municipalityId_fkey` FOREIGN KEY (`termId`, `municipalityId`) REFERENCES `council_terms`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_agenda_items` ADD CONSTRAINT `session_agenda_items_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `legislative_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_agenda_items` ADD CONSTRAINT `session_agenda_items_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_attendance` ADD CONSTRAINT `session_attendance_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `legislative_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_attendance` ADD CONSTRAINT `session_attendance_personId_municipalityId_fkey` FOREIGN KEY (`personId`, `municipalityId`) REFERENCES `persons`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_votes` ADD CONSTRAINT `session_votes_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `legislative_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `session_votes` ADD CONSTRAINT `session_votes_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;
