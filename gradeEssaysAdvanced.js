require('dotenv').config();
const MoodleBot = require('./moodleBot');
const EssayEvaluator = require('./essayEvaluator');
const GradingUtils = require('./gradingUtils');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

class AdvancedGradingOrchestrator {
  constructor(config) {
    this.config = config;
    this.moodleBot = new MoodleBot(config);
    this.evaluator = new EssayEvaluator(config);
    this.gradeResults = [];
    this.checkpointPath = './checkpoints/grading-checkpoint.json';
    this.backupPath = './backups';
    this.startTime = null;
    this.processedCount = 0;
    this.totalCount = 0;
  }

  async initialize() {
    try {
      logger.info('='.repeat(60));
      logger.info('Initializing Advanced Grading Orchestrator');
      logger.info('='.repeat(60));

      // Validate configurations
      GradingUtils.validateMoodleConfig(this.config);
      GradingUtils.validateOpenAIConfig(this.config);

      // Create necessary directories
      [this.backupPath, path.dirname(this.checkpointPath), 'logs', 'results'].forEach(dir => {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      });

      // Launch browser dan login
      await this.moodleBot.launch();
      await this.moodleBot.login();

      // Check for checkpoint
      const checkpoint = GradingUtils.loadCheckpoint(this.checkpointPath);
      if (checkpoint) {
        logger.info(`Found checkpoint - resuming from submission ${checkpoint.processedCount}`);
        this.gradeResults = checkpoint.results || [];
        this.processedCount = checkpoint.processedCount || 0;
      }

      this.startTime = new Date();
      logger.info('Orchestrator initialized successfully');
      logger.info('='.repeat(60) + '\n');
    } catch (error) {
      logger.error('Failed to initialize orchestrator:', error);
      throw error;
    }
  }

  async processSubmissionsWithBatching() {
    try {
      logger.info('Fetching all submissions...');

      // Get all submissions
      const submissions = await this.moodleBot.getEssaySubmissions(
        this.config.MOODLE_COURSE_ID,
        this.config.MOODLE_QUIZ_ID
      );

      this.totalCount = submissions.length;

      if (this.totalCount === 0) {
        logger.warn('No submissions found to grade');
        return;
      }

      // Create backup before processing
      const backupFile = GradingUtils.createBackup({
        config: {
          courseId: this.config.MOODLE_COURSE_ID,
          quizId: this.config.MOODLE_QUIZ_ID
        },
        submissionsCount: this.totalCount,
        submissions: submissions.slice(0, 10) // Backup first 10 untuk reference
      }, this.backupPath);

      logger.info(`Total submissions: ${this.totalCount}`);
      logger.info(`Resume from: ${this.processedCount}`);
      logger.info(`Remaining: ${this.totalCount - this.processedCount}\n`);

      // Process submissions
      const pointsScale = Number.isFinite(this.config.POINTS_SCALE) ? this.config.POINTS_SCALE : 12;
      const minPoints = Number.isFinite(this.config.MIN_POINTS) ? this.config.MIN_POINTS : 0;
      const maxPoints = Number.isFinite(this.config.MAX_POINTS) ? this.config.MAX_POINTS : pointsScale;
      const rubricGuideFile = this.config.RUBRIC_GUIDE_FILE || './rubric.md';

      if (!fs.existsSync(rubricGuideFile)) {
        logger.warn(`Rubric guide file not found: ${rubricGuideFile}`);
      }

      for (let i = this.processedCount; i < submissions.length; i++) {
        const submission = submissions[i];
        const progress = `[${i + 1}/${this.totalCount}]`;

        try {
          logger.info(`${progress} Processing: ${submission.studentName}...`);

          const quizAttempt = await this.moodleBot.openSubmissionForGrading(
            this.config.MOODLE_QUIZ_ID,
            submission.attemptId
          );

          const extractedQuestion = (quizAttempt.questions || [])
            .map(item => item.question)
            .filter(Boolean)
            .join('\n\n') || quizAttempt.pageTitle || `Quiz ${this.config.MOODLE_QUIZ_ID}`;

          const extractedAnswer = quizAttempt.answerText || (quizAttempt.questions || [])
            .map(item => item.answer)
            .filter(Boolean)
            .join('\n\n');

          if (!extractedAnswer || extractedAnswer.trim().length === 0) {
            logger.warn(`${progress} Empty submission from ${submission.studentName}`);
            this.gradeResults.push({
              studentName: submission.studentName,
              studentId: submission.attemptId,
              score: minPoints,
              question: extractedQuestion,
              answer: extractedAnswer,
              evaluation: { reasoning: 'Submission kosong' },
              timestamp: new Date(),
              status: 'empty'
            });
            continue;
          }

          // Evaluate dengan OpenAI
          const evaluation = await GradingUtils.retry(
            () => this.evaluator.evaluateEssay(
              extractedAnswer,
              extractedQuestion,
              null
            ),
            this.config.MAX_RETRIES || 3,
            this.config.RETRY_DELAY_MS || 1000
          );

          // Validate score
          const rawScore = GradingUtils.validateScore(evaluation.score, minPoints, maxPoints);
          const validatedScore = Number(rawScore.toFixed(2));

          // Generate feedback
          const feedback = this.generateFeedback(validatedScore, evaluation, maxPoints);
          if (!String(evaluation.comment || evaluation.reasoning || '').trim()) {
            throw new Error('AI comment is empty; grading stopped before score submission');
          }

          // Submit grade ke Moodle
          await GradingUtils.retry(
            () => this.moodleBot.submitGrade(
              this.config.MOODLE_QUIZ_ID,
              submission.attemptId,
              validatedScore,
              feedback
            ),
            this.config.MAX_RETRIES || 3,
            this.config.RETRY_DELAY_MS || 1000
          );

          // Store result
          this.gradeResults.push({
            studentName: submission.studentName,
            studentId: submission.attemptId,
            score: validatedScore,
            question: extractedQuestion,
            answer: extractedAnswer,
            evaluation: evaluation,
            timestamp: new Date(),
            status: 'success'
          });

          logger.info(`${progress} Graded ${submission.studentName}: ${validatedScore.toFixed(2)}/${maxPoints}`);

          // Save checkpoint setiap N submissions
          if ((i + 1) % this.config.CHECKPOINT_INTERVAL === 0) {
            this.saveCheckpoint(i + 1);
            logger.info(`Checkpoint saved at submission ${i + 1}`);
          }

          // Add delay untuk avoid rate limiting
          await GradingUtils.sleep(this.config.RETRY_DELAY_MS || 1000);

        } catch (error) {
          logger.error(`${progress} Error processing ${submission.studentName}:`, error.message);

          this.gradeResults.push({
            studentName: submission.studentName,
            studentId: submission.attemptId,
            score: minPoints,
            error: error.message,
            timestamp: new Date(),
            status: 'failed'
          });

          // Save checkpoint after error juga
          this.saveCheckpoint(i);
        }

        this.processedCount = i + 1;
      }

      logger.info('All submissions processed successfully');
    } catch (error) {
      logger.error('Error during submission processing:', error);
      this.saveCheckpoint(this.processedCount);
      throw error;
    }
  }

  getQuestion(submissionIndex) {
    // Implement logika untuk get pertanyaan berdasarkan submission index
    // Ini untuk handle multiple questions scenario
    return 'Berikan jawaban yang jelas dan terstruktur untuk pertanyaan ini';
  }

  generateFeedback(score, evaluation, maxPoints = 100) {
    const letterGrade = GradingUtils.getLetterGrade(score, maxPoints);
    const formattedScore = GradingUtils.formatScore(score, maxPoints);

    let feedback = `=== HASIL PENILAIAN ===\n`;
    feedback += `Skor: ${formattedScore} (Grade: ${letterGrade})\n\n`;
    feedback += `=== EVALUASI ===\n`;
    feedback += `${evaluation.reasoning || 'Lihat detail di bawah'}\n\n`;

    if (evaluation.strengths && evaluation.strengths.length > 0) {
      feedback += `=== KEKUATAN ===\n`;
      evaluation.strengths.forEach(strength => {
        feedback += `✓ ${strength}\n`;
      });
      feedback += '\n';
    }

    if (evaluation.improvements && evaluation.improvements.length > 0) {
      feedback += `=== AREA PERBAIKAN ===\n`;
      evaluation.improvements.forEach(improvement => {
        feedback += `→ ${improvement}\n`;
      });
      feedback += '\n';
    }

    feedback += `\n=== CATATAN ===\nPenilaian dilakukan secara otomatis menggunakan AI. `;
    feedback += `Silakan hubungi instruktur jika ada pertanyaan mengenai penilaian.`;

    return feedback;
  }

  saveCheckpoint(processedCount) {
    const checkpoint = {
      processedCount: processedCount,
      results: this.gradeResults,
      timestamp: new Date().toISOString()
    };
    GradingUtils.saveCheckpoint(this.checkpointPath, checkpoint);
  }

  generateDetailedReport() {
    try {
      logger.info('Generating detailed report...');

      const endTime = new Date();
      const summary = GradingUtils.generateSummaryReport(
        this.gradeResults,
        this.startTime,
        endTime
      );

      // Generate statistics
      const stats = GradingUtils.calculateStatistics(this.gradeResults);

      // Create comprehensive report
      const report = {
        metadata: {
          timestamp: new Date().toISOString(),
          moodleUrl: this.config.MOODLE_URL,
          courseId: this.config.MOODLE_COURSE_ID,
          quizId: this.config.MOODLE_QUIZ_ID,
          model: this.config.OPENAI_MODEL
        },
        summary: summary.duration,
        statistics: stats,
        results: this.gradeResults
      };

      // Save JSON report
      const reportPath = path.join('results', `report-${Date.now()}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      logger.info(`Report saved: ${reportPath}`);

      // Generate CSV report
      const csvPath = path.join('results', `report-${Date.now()}.csv`);
      GradingUtils.generateCSVReport(this.gradeResults, csvPath);

      // Print summary
      this.printSummary(stats, summary.duration);

      // Clear checkpoint after successful completion
      if (fs.existsSync(this.checkpointPath)) {
        fs.unlinkSync(this.checkpointPath);
        logger.info('Checkpoint cleared');
      }

      return { reportPath, csvPath, report };
    } catch (error) {
      logger.error('Failed to generate report:', error);
      throw error;
    }
  }

  printSummary(stats, duration) {
    console.log('\n' + '='.repeat(70));
    console.log('AUTOMATED ESSAY GRADING - FINAL REPORT');
    console.log('='.repeat(70));
    
    if (stats) {
      console.log(`\nTotal Submissions Graded: ${stats.totalGraded}`);
      console.log(`Failed Submissions: ${stats.totalFailed}`);
      console.log(`\nScore Summary:`);
      console.log(`  Average Score: ${stats.averageScore}/100`);
      console.log(`  Median Score: ${stats.medianScore}`);
      console.log(`  Highest Score: ${stats.maxScore}`);
      console.log(`  Lowest Score: ${stats.minScore}`);
      
      console.log(`\nScore Distribution:`);
      Object.entries(stats.scoreDistribution).forEach(([range, count]) => {
        const percentage = ((count / stats.totalGraded) * 100).toFixed(1);
        console.log(`  ${range}: ${count} (${percentage}%)`);
      });
    }

    console.log(`\nProcessing Time:`);
    console.log(`  Duration: ${duration.minutes} minutes (${duration.hours} hours)`);
    
    console.log('\n' + '='.repeat(70));
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
    EMPTY_SCORE: parseInt(process.env.EMPTY_SCORE || '0'),
    IRRELEVANT_MIN: parseInt(process.env.IRRELEVANT_MIN || '1'),
    IRRELEVANT_MAX: parseInt(process.env.IRRELEVANT_MAX || '4'),
    SLIGHTLY_RELEVANT_MIN: parseInt(process.env.SLIGHTLY_RELEVANT_MIN || '5'),
    SLIGHTLY_RELEVANT_MAX: parseInt(process.env.SLIGHTLY_RELEVANT_MAX || '8'),
    RELEVANT_MIN: parseInt(process.env.RELEVANT_MIN || '9'),
    RELEVANT_MAX: parseInt(process.env.RELEVANT_MAX || '12'),
    AUTO_RUBRIC: String(process.env.AUTO_RUBRIC || 'true').toLowerCase() === 'true',

    // Performance
    RETRY_DELAY_MS: parseInt(process.env.RETRY_DELAY_MS || '3000'),
    MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '5'),
    CHECKPOINT_INTERVAL: 50 // Save checkpoint setiap 50 submissions
  };

  const orchestrator = new AdvancedGradingOrchestrator(config);

  try {
    await orchestrator.initialize();
    await orchestrator.processSubmissionsWithBatching();
    orchestrator.generateDetailedReport();
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

module.exports = AdvancedGradingOrchestrator;
