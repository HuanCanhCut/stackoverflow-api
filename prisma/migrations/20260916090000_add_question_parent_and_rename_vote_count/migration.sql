-- AlterTable
ALTER TABLE `questions`
    CHANGE COLUMN `votes` `vote_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `parent_id` INTEGER NULL;

-- CreateIndex
CREATE INDEX `questions_parent_id_idx` ON `questions`(`parent_id`);

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
