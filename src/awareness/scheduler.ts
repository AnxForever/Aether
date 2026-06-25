/**
 * Awareness Scheduler - Automate diary and reflection generation
 */

import { Cron } from 'croner';
import { AwarenessSystem } from './awareness-system';
import { createLogger } from '../utils/logger';

const logger = createLogger('AwarenessScheduler');

export class AwarenessScheduler {
  private diaryJob?: Cron;
  private reflectionJob?: Cron;
  private awarenessSystem: AwarenessSystem;

  constructor(awarenessSystem: AwarenessSystem) {
    this.awarenessSystem = awarenessSystem;
  }

  /**
   * Start scheduled tasks
   */
  start(diaryCron: string = '0 21 * * *', reflectionCron: string = '30 21 * * *'): void {
    // Daily diary at 9:00 PM
    this.diaryJob = new Cron(diaryCron, async () => {
      try {
        logger.info('Scheduled diary generation triggered');
        await this.awarenessSystem.generateDailyDiary();
      } catch (error: any) {
        logger.error('Diary generation failed:', error as Error);
      }
    });

    // Daily episode at 9:30 PM
    this.reflectionJob = new Cron(reflectionCron, async () => {
      try {
        logger.info('Scheduled episode generation triggered');
        await this.awarenessSystem.generateDailyEpisode();
      } catch (error: any) {
        logger.error('Episode generation failed:', error as Error);
      }
    });

    logger.info(`Awareness scheduler started (diary: ${diaryCron}, reflection: ${reflectionCron})`);
  }

  /**
   * Stop scheduled tasks
   */
  stop(): void {
    this.diaryJob?.stop();
    this.reflectionJob?.stop();
    logger.info('Awareness scheduler stopped');
  }

  /**
   * Trigger manual diary generation
   */
  async triggerDiaryNow(): Promise<void> {
    logger.info('Manual diary generation triggered');
    await this.awarenessSystem.generateDailyDiary();
  }

  /**
   * Trigger manual episode generation
   */
  async triggerEpisodeNow(): Promise<void> {
    logger.info('Manual episode generation triggered');
    await this.awarenessSystem.generateDailyEpisode();
  }
}
