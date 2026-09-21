-- CreateTable
CREATE TABLE `measure_types` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `code` VARCHAR(20) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `retiredAt` DATETIME(3) NULL,

    UNIQUE INDEX `measure_types_municipalityId_code_key`(`municipalityId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `legislative_measures` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `typeId` CHAR(36) NOT NULL,
    `typeCode` VARCHAR(20) NOT NULL,
    `termId` CHAR(36) NOT NULL,
    `title` VARCHAR(240) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `stage` VARCHAR(20) NOT NULL,
    `classification` VARCHAR(30) NOT NULL DEFAULT 'INTERNAL',
    `officialSeries` VARCHAR(30) NULL,
    `officialYear` INTEGER NULL,
    `officialNumber` INTEGER NULL,
    `currentVersionId` CHAR(36) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `legislative_measures_id_municipalityId_key`(`id`, `municipalityId`),
    UNIQUE INDEX `measures_official_number_key`(`municipalityId`, `officialSeries`, `officialYear`, `officialNumber`),
    INDEX `legislative_measures_municipalityId_stage_createdAt_idx`(`municipalityId`, `stage`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measure_authors` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `personId` CHAR(36) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `ordering` INTEGER NOT NULL,
    `displayName` VARCHAR(160) NOT NULL,

    UNIQUE INDEX `measure_authors_measureId_personId_role_key`(`measureId`, `personId`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measure_versions` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `parentVersionId` CHAR(36) NULL,
    `synopsis` VARCHAR(8000) NOT NULL,
    `primaryDocumentVersionId` CHAR(36) NULL,
    `frozenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `measure_versions_measureId_sequence_key`(`measureId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measure_status_history` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `fromStage` VARCHAR(20) NULL,
    `toStage` VARCHAR(20) NOT NULL,
    `profileVersionId` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `measure_status_history_measureId_sequence_key`(`measureId`, `sequence`),
    INDEX `measure_status_history_measureId_recordedAt_idx`(`measureId`, `recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_profiles` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `description` VARCHAR(240) NOT NULL,

    UNIQUE INDEX `workflow_profiles_municipalityId_code_key`(`municipalityId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_profile_versions` (
    `id` CHAR(36) NOT NULL,
    `profileId` CHAR(36) NOT NULL,
    `version` INTEGER NOT NULL,
    `state` VARCHAR(20) NOT NULL,
    `authorityNote` VARCHAR(240) NOT NULL,

    UNIQUE INDEX `workflow_profile_versions_profileId_version_key`(`profileId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_transitions` (
    `id` CHAR(36) NOT NULL,
    `profileVersionId` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `fromStage` VARCHAR(20) NOT NULL,
    `toStage` VARCHAR(20) NOT NULL,
    `permission` VARCHAR(40) NOT NULL,

    UNIQUE INDEX `workflow_transitions_profileVersionId_code_fromStage_key`(`profileVersionId`, `code`, `fromStage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_instances` (
    `id` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NOT NULL,
    `profileVersionId` CHAR(36) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `workflow_instances_measureId_key`(`measureId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `number_sequences` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `series` VARCHAR(30) NOT NULL,
    `typeCode` VARCHAR(20) NOT NULL,
    `year` INTEGER NOT NULL,
    `nextValue` INTEGER NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `number_sequences_municipalityId_series_typeCode_year_key`(`municipalityId`, `series`, `typeCode`, `year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `ownerType` VARCHAR(20) NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `classification` VARCHAR(30) NOT NULL,
    `currentReadyVersionId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documents_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `document_versions` (
    `id` CHAR(36) NOT NULL,
    `documentId` CHAR(36) NOT NULL,
    `sequence` INTEGER NOT NULL,
    `bucket` VARCHAR(80) NOT NULL,
    `objectKey` VARCHAR(255) NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `detectedMime` VARCHAR(120) NOT NULL,
    `originalFilename` VARCHAR(200) NOT NULL,
    `uploadedBy` CHAR(36) NOT NULL,
    `validationState` VARCHAR(20) NOT NULL,
    `scanVerdict` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `document_versions_documentId_sequence_key`(`documentId`, `sequence`),
    UNIQUE INDEX `document_versions_bucket_objectKey_key`(`bucket`, `objectKey`),
    INDEX `document_versions_sha256_idx`(`sha256`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `upload_sessions` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `uploaderId` CHAR(36) NOT NULL,
    `ownerType` VARCHAR(20) NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `originalFilename` VARCHAR(200) NOT NULL,
    `declaredMime` VARCHAR(120) NOT NULL,
    `expectedBytes` INTEGER NOT NULL,
    `quarantineKey` VARCHAR(255) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `upload_sessions_quarantineKey_key`(`quarantineKey`),
    INDEX `upload_sessions_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tasks` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `ownerType` VARCHAR(20) NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `measureId` CHAR(36) NULL,
    `title` VARCHAR(240) NOT NULL,
    `state` VARCHAR(20) NOT NULL,
    `assigneeId` CHAR(36) NULL,
    `completionNote` VARCHAR(500) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tasks_assigneeId_state_idx`(`assigneeId`, `state`),
    INDEX `tasks_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `eventKey` VARCHAR(80) NOT NULL,
    `summary` VARCHAR(240) NOT NULL,
    `ownerType` VARCHAR(20) NOT NULL,
    `ownerId` CHAR(36) NOT NULL,
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `measure_types` ADD CONSTRAINT `measure_types_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `legislative_measures` ADD CONSTRAINT `legislative_measures_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `legislative_measures` ADD CONSTRAINT `legislative_measures_typeId_fkey` FOREIGN KEY (`typeId`) REFERENCES `measure_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `legislative_measures` ADD CONSTRAINT `legislative_measures_termId_municipalityId_fkey` FOREIGN KEY (`termId`, `municipalityId`) REFERENCES `council_terms`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measure_authors` ADD CONSTRAINT `measure_authors_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measure_authors` ADD CONSTRAINT `measure_authors_personId_municipalityId_fkey` FOREIGN KEY (`personId`, `municipalityId`) REFERENCES `persons`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measure_versions` ADD CONSTRAINT `measure_versions_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `measure_status_history` ADD CONSTRAINT `measure_status_history_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_profiles` ADD CONSTRAINT `workflow_profiles_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_profile_versions` ADD CONSTRAINT `workflow_profile_versions_profileId_fkey` FOREIGN KEY (`profileId`) REFERENCES `workflow_profiles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_transitions` ADD CONSTRAINT `workflow_transitions_profileVersionId_fkey` FOREIGN KEY (`profileVersionId`) REFERENCES `workflow_profile_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instances` ADD CONSTRAINT `workflow_instances_measureId_fkey` FOREIGN KEY (`measureId`) REFERENCES `legislative_measures`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_instances` ADD CONSTRAINT `workflow_instances_profileVersionId_fkey` FOREIGN KEY (`profileVersionId`) REFERENCES `workflow_profile_versions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `number_sequences` ADD CONSTRAINT `number_sequences_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_measureId_municipalityId_fkey` FOREIGN KEY (`measureId`, `municipalityId`) REFERENCES `legislative_measures`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
