require('dotenv').config();
const MoodleBot = require('./moodleBot');
const EssayEvaluator = require('./essayEvaluator');
const GradingUtils = require('./gradingUtils');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

class GradingOrchestrator {
  constructor(config) {
    this.config = config;
    this.moodleBot = new MoodleBot(config);
    this.evaluator = new EssayEvaluator(config);
    this.gradeResults = [];
    this.regradeValidationQueue = [];
    this.startTime = null;
  }

  async initialize() {
    try {
      logger.info('Initializing Grading Orchestrator...');
      await this.moodleBot.launch();
      await this.moodleBot.login();
      this.startTime = new Date();
      logger.info('Orchestrator initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  async processSubmissions() {
    try {
      logger.info('Starting submission processing...');

      // Get all submissions
      const submissions = await this.moodleBot.getEssaySubmissions(
        this.config.MOODLE_COURSE_ID,
        this.config.MOODLE_QUIZ_ID
      );

      if (submissions.length === 0) {
        logger.warn('No submissions found to grade');
        return;
      }

      const regradeAgain = String(this.config.REGRADE_AGAIN || 'false').toLowerCase() === 'true';
      const regradeThreshold = Number.isFinite(this.config.REGRADE_THRESHOLD) ? this.config.REGRADE_THRESHOLD : 40;
      const isUngradedSubmission = (submission) => {
        const status = String(submission?.status || '').toLowerCase();
        return status.includes('belum dinilai') || status.includes('not graded');
      };
      const attemptScoreSummary = submissions.map(item => ({
        attemptId: item.attemptId,
        score: Number.isFinite(item.currentScore) ? item.currentScore : null,
        selected: regradeAgain ? Boolean(item.eligibleForRegrade) : isUngradedSubmission(item)
      }));
      const eligibleSubmissions = regradeAgain
        ? submissions.filter(submission => Boolean(submission.eligibleForRegrade))
        : submissions.filter(submission => isUngradedSubmission(submission));

      logger.info(`Processing ${eligibleSubmissions.length} submissions...`);

      if (regradeAgain) {
        const selectedAttempts = attemptScoreSummary.filter(item => item.selected).map(item => `${item.attemptId}:${item.score ?? 'na'}`);
        const skippedAttempts = attemptScoreSummary.filter(item => !item.selected).map(item => `${item.attemptId}:${item.score ?? 'na'}`);
        logger.info(`Regrade mode enabled. Threshold=${regradeThreshold}. Selected attempts: ${selectedAttempts.join(', ') || 'none'}`);
        logger.info(`Regrade mode skipped attempts: ${skippedAttempts.join(', ') || 'none'}`);
      }

      if (eligibleSubmissions.length === 0) {
        logger.warn('No submissions found to grade');
        return;
      }

      const pointsScale = Number.isFinite(this.config.POINTS_SCALE) ? this.config.POINTS_SCALE : 12;
      const minPoints = Number.isFinite(this.config.MIN_POINTS) ? this.config.MIN_POINTS : 0;
      const maxPoints = Number.isFinite(this.config.MAX_POINTS) ? this.config.MAX_POINTS : pointsScale;
      const actionDelayMs = Number.isFinite(this.config.RETRY_DELAY_MS) ? this.config.RETRY_DELAY_MS : 3000;
      const rubricEnabled = String(process.env.RUBRIC_ENABLED || 'false').toLowerCase() === 'true';
      const rubricGuideFile = this.config.RUBRIC_GUIDE_FILE || './rubric.md';
      if (!fs.existsSync(rubricGuideFile)) {
        logger.warn(`Rubric guide file not found: ${rubricGuideFile}`);
      }

      const tokenize = (text) => {
        return String(text || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/gi, ' ')
          .split(/\s+/)
          .map(token => token.trim())
          .filter(token => token.length > 2);
      };

      const calculateSimilarity = (left, right) => {
        const leftTokens = new Set(tokenize(left));
        const rightTokens = new Set(tokenize(right));
        if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
        let overlap = 0;
        for (const token of leftTokens) {
          if (rightTokens.has(token)) overlap++;
        }
        return overlap / Math.max(leftTokens.size, rightTokens.size);
      };

      // Process submissions dalam batch
      for (let i = 0; i < eligibleSubmissions.length; i++) {
        const submission = eligibleSubmissions[i];
        const progress = `[${i + 1}/${eligibleSubmissions.length}]`;

        try {
          logger.info(`${progress} Processing submission from ${submission.studentName}...`);

          // Guard: if regrade mode and attempt score is >= threshold, skip entirely
          if (regradeAgain && Number.isFinite(submission.currentScore) && submission.currentScore >= regradeThreshold) {
            logger.info(`${progress} Skipping ${submission.attemptId}: score ${submission.currentScore} >= threshold ${regradeThreshold}`);
            await this.delay(actionDelayMs);
            continue;
          }

          const slots = await this.moodleBot.getQuizSlots(submission.attemptId, 5);

          for (const slotInfo of slots) {
            const slotProgress = `${progress} [slot ${slotInfo.slot}]`;
            try {
              const slotContent = await this.moodleBot.openQuizSlot(submission.attemptId, slotInfo.slot);
              const extractedQuestion = slotContent.questionText || `Quiz ${this.config.MOODLE_QUIZ_ID} slot ${slotInfo.slot}`;
              const extractedAnswer = slotContent.answerText || '';
              if (!extractedAnswer.trim()) {
                logger.warn(`${slotProgress} Empty answer`);
                this.gradeResults.push({
                  studentName: submission.studentName,
                  studentId: submission.attemptId,
                  slot: slotInfo.slot,
                  score: 0,
                  evaluation: { reasoning: 'Jawaban kosong' },
                  question: extractedQuestion,
                  answer: extractedAnswer,
                  timestamp: new Date(),
                  status: 'empty'
                });
                await this.delay(actionDelayMs);
                continue;
              }

              const evaluation = await this.evaluator.evaluateEssay(extractedAnswer, extractedQuestion, null);
              const rawScore = Number(evaluation.score);
              const validatedScore = Number(GradingUtils.validateScore(rawScore, minPoints, maxPoints).toFixed(2));

              logger.info(`${slotProgress} Raw AI score=${rawScore}, validated score=${validatedScore.toFixed(2)}/${maxPoints}`);

              const comment = String(evaluation.comment || evaluation.reasoning || '').trim();
              if (!comment) {
                throw new Error('AI comment is empty; grading stopped before score submission');
              }

              const feedback = `Skor: ${validatedScore.toFixed(2)}/${maxPoints}\n\nKomentar: ${comment}\n\nKekuatan:\n${(evaluation.strengths || []).map(s => `- ${s}`).join('\n')}\n\nArea Perbaikan:\n${(evaluation.improvements || []).map(i => `- ${i}`).join('\n')}`;

              await this.moodleBot.submitSlotMark(validatedScore, feedback);

              this.gradeResults.push({
                studentName: submission.studentName,
                studentId: submission.attemptId,
                slot: slotInfo.slot,
                score: validatedScore,
                question: extractedQuestion,
                answer: extractedAnswer,
                evaluation,
                timestamp: new Date(),
                status: 'success'
              });

              if (regradeAgain && validatedScore < regradeThreshold) {
                this.regradeValidationQueue.push({
                  attemptId: submission.attemptId,
                  studentName: submission.studentName,
                  slot: slotInfo.slot,
                  score: validatedScore,
                  threshold: regradeThreshold,
                  timestamp: new Date().toISOString(),
                  note: 'Regraded but still below threshold; queued for next validation'
                });
                logger.info(`${slotProgress} Regrade validation queued for attempt ${submission.attemptId} with score ${validatedScore.toFixed(2)} below threshold ${regradeThreshold}`);
              }
              await this.delay(actionDelayMs);
            } catch (slotError) {
              logger.error(`${slotProgress} Failed: ${slotError.message}`);
              logger.error(slotError.stack || 'No stack trace available');
              this.gradeResults.push({
                studentName: submission.studentName,
                studentId: submission.attemptId,
                slot: slotInfo.slot,
                score: 0,
                error: slotError.message,
                timestamp: new Date(),
                status: 'failed'
              });
              await this.delay(actionDelayMs);
            }
          }
        } catch (error) {
          logger.error(`${progress} Failed to process ${submission.studentName}: ${error.message}`);
          logger.error(error.stack || 'No stack trace available');
          this.gradeResults.push({
            studentName: submission.studentName,
            studentId: submission.attemptId,
            score: 0,
            error: error.message,
            timestamp: new Date(),
            status: 'failed'
          });
          await this.delay(actionDelayMs);
        }
      }

      logger.info('All submissions processed');
    } catch (error) {
      logger.error('Error during submission processing:', error);
      throw error;
    }
  }

  generateReport() {
    try {
      const endTime = new Date();
      const duration = (endTime - this.startTime) / 1000 / 60; // minutes

      const successCount = this.gradeResults.filter(r => r.status === 'success').length;
      const failedCount = this.gradeResults.filter(r => r.status === 'failed').length;
      const successResults = this.gradeResults.filter(r => r.status === 'success');
        const avgScore = successResults.length > 0
          ? (successResults.reduce((sum, r) => sum + r.score, 0) / successResults.length).toFixed(2)
          : '0.00';

      const report = {
        summary: {
          totalSubmissions: this.gradeResults.length,
          successfulGrades: successCount,
          failedGrades: failedCount,
          averageScore: avgScore,
          startTime: this.startTime,
          endTime: endTime,
          durationMinutes: duration.toFixed(2)
        },
        results: this.gradeResults,
        regradeValidationQueue: this.regradeValidationQueue,
        timestamp: new Date().toISOString()
      };

      // Save report ke file
      const reportPath = path.join(__dirname, 'logs', `report-${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      logger.info(`Report saved to ${reportPath}`);

      // Print summary
      console.log('\n' + '='.repeat(60));
      console.log('GRADING SUMMARY');
      console.log('='.repeat(60));
      console.log(`Total Submissions: ${report.summary.totalSubmissions}`);
      console.log(`Successfully Graded: ${report.summary.successfulGrades}`);
      console.log(`Failed: ${report.summary.failedGrades}`);
      console.log(`Average Score: ${report.summary.averageScore}/100`);
      console.log(`Duration: ${report.summary.durationMinutes} minutes`);
      console.log('='.repeat(60) + '\n');

      return report;
    } catch (error) {
      logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async cleanup() {
    try {
      logger.info('Cleaning up resources...');
      await this.moodleBot.close();
      logger.info('Cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }
}

// Main execution
async function main() {
  const config = {
    // Moodle
    MOODLE_URL: process.env.MOODLE_URL,
    MOODLE_USERNAME: process.env.MOODLE_USERNAME,
    MOODLE_PASSWORD: process.env.MOODLE_PASSWORD,
    MOODLE_COURSE_ID: parseInt(process.env.MOODLE_COURSE_ID),
    MOODLE_QUIZ_ID: parseInt(process.env.MOODLE_QUIZ_ID || process.env.MOODLE_ASSIGNMENT_ID),

    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4',
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE || '0.3'),
    OPENAI_MAX_TOKENS: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),

    // Grading
    POINTS_SCALE: parseInt(process.env.POINTS_SCALE || '12'),
    MIN_POINTS: parseInt(process.env.MIN_POINTS || '0'),
    MAX_POINTS: parseInt(process.env.MAX_POINTS || '12'),
    BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '5'),
    CONCURRENT_REQUESTS: parseInt(process.env.CONCURRENT_REQUESTS || '3'),
    TIMEOUT_MS: parseInt(process.env.TIMEOUT_MS || '60000'),
    REGRADE_AGAIN: String(process.env.REGRADE_AGAIN || 'false').toLowerCase() === 'true',
    REGRADE_THRESHOLD: parseInt(process.env.REGRADE_THRESHOLD || '40'),
    EMPTY_SCORE: parseInt(process.env.EMPTY_SCORE || '0'),
    IRRELEVANT_MIN: parseInt(process.env.IRRELEVANT_MIN || '1'),
    IRRELEVANT_MAX: parseInt(process.env.IRRELEVANT_MAX || '4'),
    SLIGHTLY_RELEVANT_MIN: parseInt(process.env.SLIGHTLY_RELEVANT_MIN || '5'),
    SLIGHTLY_RELEVANT_MAX: parseInt(process.env.SLIGHTLY_RELEVANT_MAX || '8'),
    RELEVANT_MIN: parseInt(process.env.RELEVANT_MIN || '9'),
    RELEVANT_MAX: parseInt(process.env.RELEVANT_MAX || '12'),

    // Performance
    RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS || '3000'),
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '5')
  };

  logger.info(`Resolved regrade config: REGRADE_AGAIN=${config.REGRADE_AGAIN}, REGRADE_THRESHOLD=${config.REGRADE_THRESHOLD}`);
  logger.info(`Environment regrade raw values: REGRADE_AGAIN=${process.env.REGRADE_AGAIN}, REGRADE_THRESHOLD=${process.env.REGRADE_THRESHOLD}`);

  // Validate required config
  const requiredFields = ['MOODLE_URL', 'MOODLE_USERNAME', 'MOODLE_PASSWORD', 'OPENAI_API_KEY'];
  for (const field of requiredFields) {
    if (!config[field]) {
      logger.error(`Missing required configuration: ${field}`);
      process.exit(1);
    }
  }

  const orchestrator = new GradingOrchestrator(config);

  try {
    await orchestrator.initialize();
    await orchestrator.processSubmissions();
    orchestrator.generateReport();
  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await orchestrator.cleanup();
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = GradingOrchestrator;
