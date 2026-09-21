-- CreateTable
CREATE TABLE `municipalities` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `timezone` VARCHAR(50) NOT NULL DEFAULT 'Asia/Manila',
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `municipalities_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `issuer` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `displayName` VARCHAR(160) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `policyVersion` INTEGER NOT NULL DEFAULT 1,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `users_municipalityId_enabled_idx`(`municipalityId`, `enabled`),
    UNIQUE INDEX `users_issuer_subject_key`(`issuer`, `subject`),
    UNIQUE INDEX `users_id_municipalityId_key`(`id`, `municipalityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `scopeType` VARCHAR(20) NOT NULL,
    `scopeId` CHAR(36) NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `approvedBy` CHAR(36) NOT NULL,
    `requestId` CHAR(36) NULL,
    `revokedAt` DATETIME(3) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `user_roles_requestId_key`(`requestId`),
    INDEX `user_roles_userId_validUntil_idx`(`userId`, `validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `grant_requests` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `scopeType` VARCHAR(20) NOT NULL,
    `scopeId` CHAR(36) NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `requestedBy` CHAR(36) NOT NULL,
    `reviewedBy` CHAR(36) NULL,
    `state` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `reason` VARCHAR(500) NOT NULL,
    `reviewReason` VARCHAR(500) NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `grant_requests_municipalityId_state_idx`(`municipalityId`, `state`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `council_terms` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `label` VARCHAR(80) NOT NULL,
    `startsOn` DATE NOT NULL,
    `endsOn` DATE NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `council_terms_municipalityId_label_key`(`municipalityId`, `label`),
    UNIQUE INDEX `council_terms_id_municipalityId_key`(`id`, `municipalityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `persons` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `displayName` VARCHAR(160) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `persons_municipalityId_displayName_idx`(`municipalityId`, `displayName`),
    UNIQUE INDEX `persons_id_municipalityId_key`(`id`, `municipalityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `committees` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `termId` CHAR(36) NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `revision` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `committees_municipalityId_termId_code_key`(`municipalityId`, `termId`, `code`),
    UNIQUE INDEX `committees_id_municipalityId_key`(`id`, `municipalityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `committee_members` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `committeeId` CHAR(36) NOT NULL,
    `personId` CHAR(36) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `startsOn` DATE NOT NULL,
    `endsOn` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `committee_members_committeeId_endsOn_idx`(`committeeId`, `endsOn`),
    UNIQUE INDEX `committee_members_committeeId_personId_role_startsOn_key`(`committeeId`, `personId`, `role`, `startsOn`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_cursors` (
    `municipalityId` CHAR(36) NOT NULL,
    `sequence` BIGINT NOT NULL DEFAULT 0,
    `hash` CHAR(64) NOT NULL,

    PRIMARY KEY (`municipalityId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `sequence` BIGINT NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `actorName` VARCHAR(160) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `entityId` CHAR(36) NOT NULL,
    `correlationId` CHAR(36) NOT NULL,
    `payload` JSON NOT NULL,
    `previousHash` CHAR(64) NOT NULL,
    `hash` CHAR(64) NOT NULL,
    `recordedAt` DATETIME(3) NOT NULL,

    INDEX `audit_logs_municipalityId_recordedAt_idx`(`municipalityId`, `recordedAt`),
    UNIQUE INDEX `audit_logs_municipalityId_sequence_key`(`municipalityId`, `sequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` CHAR(36) NOT NULL,
    `municipalityId` CHAR(36) NOT NULL,
    `type` VARCHAR(80) NOT NULL,
    `payload` JSON NOT NULL,
    `state` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `outbox_events_state_availableAt_idx`(`state`, `availableAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `consumer_receipts` (
    `id` CHAR(36) NOT NULL,
    `consumer` VARCHAR(80) NOT NULL,
    `eventId` CHAR(36) NOT NULL,
    `completedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `consumer_receipts_consumer_eventId_key`(`consumer`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `idempotency_records` (
    `id` CHAR(36) NOT NULL,
    `actorId` CHAR(36) NOT NULL,
    `action` VARCHAR(80) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `requestHash` CHAR(64) NOT NULL,
    `result` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `idempotency_records_actorId_action_key_key`(`actorId`, `action`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_userId_municipalityId_fkey` FOREIGN KEY (`userId`, `municipalityId`) REFERENCES `users`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `council_terms` ADD CONSTRAINT `council_terms_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `persons` ADD CONSTRAINT `persons_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committees` ADD CONSTRAINT `committees_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committees` ADD CONSTRAINT `committees_termId_municipalityId_fkey` FOREIGN KEY (`termId`, `municipalityId`) REFERENCES `council_terms`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_members` ADD CONSTRAINT `committee_members_committeeId_municipalityId_fkey` FOREIGN KEY (`committeeId`, `municipalityId`) REFERENCES `committees`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `committee_members` ADD CONSTRAINT `committee_members_personId_municipalityId_fkey` FOREIGN KEY (`personId`, `municipalityId`) REFERENCES `persons`(`id`, `municipalityId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_cursors` ADD CONSTRAINT `audit_cursors_municipalityId_fkey` FOREIGN KEY (`municipalityId`) REFERENCES `municipalities`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
