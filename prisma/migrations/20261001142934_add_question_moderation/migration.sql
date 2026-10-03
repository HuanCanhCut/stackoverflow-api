-- AlterTable
ALTER TABLE `questions` ADD COLUMN `moderated_at` DATETIME(3) NULL,
    ADD COLUMN `moderation_reason` VARCHAR(500) NULL,
    ADD COLUMN `moderation_status` ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX `questions_moderation_status_idx` ON `questions`(`moderation_status`);

-- Nội dung đăng trước khi có kiểm duyệt coi như đã duyệt
UPDATE `questions` SET `moderation_status` = 'approved', `moderated_at` = CURRENT_TIMESTAMP(3);
