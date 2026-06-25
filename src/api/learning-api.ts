/**
 * Learning API - HTTP endpoints for learning system
 *
 * Provides REST API access to learning system features
 */

import { Router, Request, Response } from 'express';
import { Orchestrator } from '../core/orchestrator';
import { createLogger } from '../utils/logger';

const logger = createLogger('LearningAPI');

export interface LearningAPIConfig {
  orchestrator: Orchestrator;
}

/**
 * Create learning API router
 */
export function createLearningAPI(config: LearningAPIConfig): Router {
  const router = Router();
  const { orchestrator } = config;

  /**
   * POST /api/learning/feedback
   * Record user feedback on a message
   */
  router.post('/feedback', async (req: Request, res: Response) => {
    try {
      const { sessionId, messageId, rating, comment, correctedResponse } = req.body;

      // Validate
      if (!sessionId || !messageId || typeof rating !== 'number') {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: sessionId, messageId, rating'
        });
        return;
      }

      if (rating < 1 || rating > 5) {
        res.status(400).json({
          success: false,
          error: 'Rating must be between 1 and 5'
        });
        return;
      }

      const feedbackId = await orchestrator.recordUserFeedback(
        sessionId,
        messageId,
        rating,
        comment,
        correctedResponse
      );

      res.json({
        success: true,
        data: { feedbackId }
      });
    } catch (error: any) {
      logger.error('Failed to record feedback:', error as Error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/learning/stats
   * Get current learning statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await orchestrator.getLearningStats();

      if (!stats) {
        res.status(404).json({
          success: false,
          error: 'Learning system not enabled'
        });
        return;
      }

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Failed to get learning stats:', error as Error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/learning/report
   * Generate learning report for a time range
   */
  router.get('/report', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const end = Date.now();
      const start = end - (days * 24 * 60 * 60 * 1000);

      const report = await orchestrator.generateLearningReport({ start, end });

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Learning system not enabled'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          report,
          timeRange: {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            days
          }
        }
      });
    } catch (error: any) {
      logger.error('Failed to generate report:', error as Error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/learning/suggestions
   * Get improvement suggestions
   */
  router.get('/suggestions', async (req: Request, res: Response) => {
    try {
      const learningIntegration = orchestrator.getLearningIntegration();

      if (!learningIntegration) {
        res.status(404).json({
          success: false,
          error: 'Learning system not enabled'
        });
        return;
      }

      const suggestions = await learningIntegration.getImprovementSuggestions();

      res.json({
        success: true,
        data: {
          suggestions,
          count: suggestions.length
        }
      });
    } catch (error: any) {
      logger.error('Failed to get suggestions:', error as Error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/learning/skills/stats
   * Get skill usage statistics
   */
  router.get('/skills/stats', async (req: Request, res: Response) => {
    try {
      const learningIntegration = orchestrator.getLearningIntegration();

      if (!learningIntegration) {
        res.status(404).json({
          success: false,
          error: 'Learning system not enabled'
        });
        return;
      }

      const skillId = req.query.skillId as string | undefined;
      const stats = await learningIntegration.getSkillStats(skillId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error('Failed to get skill stats:', error as Error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/learning/satisfaction
   * Get average user satisfaction
   */
  router.get('/satisfaction', async (req: Request, res: Response) => {
    try {
      const learningIntegration = orchestrator.getLearningIntegration();

      if (!learningIntegration) {
        res.status(404).json({
          success: false,
          error: 'Learning system not enabled'
        });
        return;
      }

      const days = parseInt(req.query.days as string) || 7;
      const end = Date.now();
      const start = end - (days * 24 * 60 * 60 * 1000);

      const avgSatisfaction = await learningIntegration.getAverageSatisfaction({ start, end });

      res.json({
        success: true,
        data: {
          averageRating: avgSatisfaction,
          maxRating: 5,
          timeRange: {
            start: new Date(start).toISOString(),
            end: new Date(end).toISOString(),
            days
          }
        }
      });
    } catch (error: any) {
      logger.error('Failed to get satisfaction:', error as Error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return router;
}
