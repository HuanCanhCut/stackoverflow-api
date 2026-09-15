-- CreateTable
CREATE TABLE `post_scores` (
    `question_id` INTEGER NOT NULL,
    `score` DOUBLE NOT NULL DEFAULT 0,
    `calculated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `post_scores_score_idx`(`score`),
    PRIMARY KEY (`question_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `questions_created_at_idx` ON `questions`(`created_at`);

-- AddForeignKey
ALTER TABLE `post_scores` ADD CONSTRAINT `post_scores_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
