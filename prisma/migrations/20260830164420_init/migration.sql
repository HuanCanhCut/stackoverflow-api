-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NULL,
    `first_name` VARCHAR(191) NULL,
    `last_name` VARCHAR(191) NULL,
    `nickname` VARCHAR(100) NOT NULL,
    `avatar_path` VARCHAR(191) NULL,
    `bio` VARCHAR(500) NULL,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_blocked` BOOLEAN NOT NULL DEFAULT false,
    `blocked_at` DATETIME(3) NULL,
    `blocked_reason` TEXT NULL,
    `sign_in_provider` ENUM('email', 'google.com', 'github.com') NOT NULL DEFAULT 'email',
    `blocked_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_nickname_key`(`nickname`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_blocked_by_fkey` FOREIGN KEY (`blocked_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
