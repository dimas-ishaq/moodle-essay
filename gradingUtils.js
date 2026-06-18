const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class GradingUtils {
  /**
   * Load rubric dari file markdown
   */
  static loadRubric(rubricPath = './rubric.md') {
    try {
      if (!fs.existsSync(rubricPath)) {
        logger.warn(`Rubric file tidak ditemukan: ${rubricPath}`);
        return null;
      }
      return fs.readFileSync(rubricPath, 'utf-8');
    } catch (error) {
      logger.error(`Failed to load rubric: ${error.message}`);
      return null;
    }
  }

  static normalizeText(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter(token => token.length > 2)
      .join(' ');
  }

  static tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2);
  }

  static calculateSimilarity(left, right) {
    const leftTokens = new Set(this.tokenize(left));
    const rightTokens = new Set(this.tokenize(right));

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }

    let overlap = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) overlap++;
    }

    return overlap / Math.max(leftTokens.size, rightTokens.size);
  }

  static isRubricMismatch(questionText, rubricContext, minSimilarity = 0.22) {
    if (!rubricContext) return true;
    const rubricText = typeof rubricContext === 'string'
      ? rubricContext
      : JSON.stringify(rubricContext);
    const similarity = this.calculateSimilarity(questionText, rubricText);
    return similarity < minSimilarity;
  }

  static buildAdaptiveRubric(questionText, config = {}) {
    const subjectHint = this.normalizeText(questionText).slice(0, 200);
    return {
      version: 'adaptive-v1',
      source: 'runtime-generated',
      generatedAt: new Date().toISOString(),
      questionFingerprint: subjectHint,
      bands: {
        empty: Number.isFinite(config.EMPTY_SCORE) ? config.EMPTY_SCORE : 0,
        irrelevant: [
          Number.isFinite(config.IRRELEVANT_MIN) ? config.IRRELEVANT_MIN : 6,
          Number.isFinite(config.IRRELEVANT_MAX) ? config.IRRELEVANT_MAX : 6
        ],
        slightlyRelevant: [
          Number.isFinite(config.SLIGHTLY_RELEVANT_MIN) ? config.SLIGHTLY_RELEVANT_MIN : 8,
          Number.isFinite(config.SLIGHTLY_RELEVANT_MAX) ? config.SLIGHTLY_RELEVANT_MAX : 8
        ],
        relevantGood: [
          Number.isFinite(config.RELEVANT_MIN) ? config.RELEVANT_MIN : 10,
          Number.isFinite(config.RELEVANT_MAX) ? config.RELEVANT_MAX : 12
        ]
      },
      guidance: [
        'Nilai jawaban berdasarkan kecocokan dengan soal yang sedang tampil.',
        'Jika soal berubah jauh dari konteks sebelumnya, gunakan rubric baru yang lebih sesuai.',
        'Kosong tetap 0.',
        'Jawaban tidak relevan tetap berada di band rendah.',
        'Jawaban yang menjawab inti soal dengan baik berada di band tinggi.'
      ]
    };
  }

  /**
   * Save checkpoint untuk resume jika ada error
   */
  static saveCheckpoint(checkpointPath, data) {
    try {
      const checkpointDir = path.dirname(checkpointPath);
      if (!fs.existsSync(checkpointDir)) {
        fs.mkdirSync(checkpointDir, { recursive: true });
      }
      fs.writeFileSync(checkpointPath, JSON.stringify(data, null, 2));
      logger.info(`Checkpoint saved: ${checkpointPath}`);
    } catch (error) {
      logger.error(`Failed to save checkpoint: ${error.message}`);
    }
  }

  /**
   * Load checkpoint untuk resume
   */
  static loadCheckpoint(checkpointPath) {
    try {
      if (!fs.existsSync(checkpointPath)) {
        return null;
      }
      const data = fs.readFileSync(checkpointPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to load checkpoint: ${error.message}`);
      return null;
    }
  }

  /**
   * Validasi score dalam range yang valid
   */
  static validateScore(score, minScore = 0, maxScore = 100) {
    const numScore = parseFloat(score);
    if (isNaN(numScore)) {
      logger.warn(`Invalid score format: ${score}`);
      return Math.max(minScore, 6);
    }
    return Math.max(Math.max(minScore, 6), Math.min(maxScore, numScore));
  }

  /**
   * Parse PDF atau gambar submission jika ada
   */
  static async parseSubmissionContent(content) {
    // Jika submission adalah file binary (PDF/image), perlu handling khusus
    // Ini adalah placeholder untuk future enhancement
    return content;
  }

  /**
   * Generate report CSV dari results
   */
  static generateCSVReport(results, outputPath) {
    try {
      let csvContent = 'Student Name,Student ID,Score,Status,Evaluation,Timestamp\n';

      results.forEach(result => {
        const name = result.studentName.replace(/"/g, '""');
        const status = result.status || 'unknown';
        const evaluation = (result.evaluation?.reasoning || '').replace(/"/g, '""').replace(/\n/g, ' ');
        const timestamp = result.timestamp || new Date().toISOString();

        csvContent += `"${name}","${result.studentId}",${result.score},"${status}","${evaluation}","${timestamp}"\n`;
      });

      fs.writeFileSync(outputPath, csvContent, 'utf-8');
      logger.info(`CSV report generated: ${outputPath}`);
      return outputPath;
    } catch (error) {
      logger.error(`Failed to generate CSV report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate statistics dari grading results
   */
  static calculateStatistics(results) {
    const successResults = results.filter(r => r.status === 'success');
    
    if (successResults.length === 0) {
      return null;
    }

    const scores = successResults.map(r => r.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = sum / scores.length;
    const sorted = scores.sort((a, b) => a - b);
    const median = sorted.length % 2 === 0 
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    return {
      totalGraded: successResults.length,
      totalFailed: results.length - successResults.length,
      averageScore: avg.toFixed(2),
      medianScore: median,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      scoreDistribution: this.calculateDistribution(scores)
    };
  }

  /**
   * Hitung distribusi score
   */
  static calculateDistribution(scores) {
    const ranges = {
      'A (90-100)': 0,
      'B (80-89)': 0,
      'C (70-79)': 0,
      'D (60-69)': 0,
      'E (50-59)': 0,
      'F (0-49)': 0
    };

    scores.forEach(score => {
      if (score >= 90) ranges['A (90-100)']++;
      else if (score >= 80) ranges['B (80-89)']++;
      else if (score >= 70) ranges['C (70-79)']++;
      else if (score >= 60) ranges['D (60-69)']++;
      else if (score >= 50) ranges['E (50-59)']++;
      else ranges['F (0-49)']++;
    });

    return ranges;
  }

  /**
   * Create backup dari submission sebelum grading
   */
  static createBackup(data, backupDir = './backups') {
    try {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const backupPath = path.join(backupDir, `backup-${timestamp}.json`);
      
      fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
      logger.info(`Backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error(`Failed to create backup: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validate Moodle configuration
   */
  static validateMoodleConfig(config) {
    const required = [
      'MOODLE_URL',
      'MOODLE_USERNAME',
      'MOODLE_PASSWORD',
      'MOODLE_COURSE_ID',
      'MOODLE_ASSIGNMENT_ID'
    ];

    const missing = required.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing Moodle config: ${missing.join(', ')}`);
    }

    const placeholders = [
      'https://your-moodle-domain.com',
      'http://your-moodle-domain.com',
      'your_username',
      'your_password'
    ];

    if (placeholders.includes(String(config.MOODLE_URL).trim()) ||
        placeholders.includes(String(config.MOODLE_USERNAME).trim()) ||
        placeholders.includes(String(config.MOODLE_PASSWORD).trim())) {
      throw new Error('Moodle config still contains placeholder values. Update MOODLE_URL, MOODLE_USERNAME, and MOODLE_PASSWORD in .env.');
    }

    // Validate URL format
    try {
      new URL(config.MOODLE_URL);
    } catch (error) {
      throw new Error(`Invalid MOODLE_URL format: ${config.MOODLE_URL}`);
    }

    return true;
  }

  /**
   * Validate OpenAI configuration
   */
  static validateOpenAIConfig(config) {
    const required = ['OPENAI_API_KEY', 'OPENAI_MODEL'];

    const missing = required.filter(field => !config[field]);
    if (missing.length > 0) {
      throw new Error(`Missing OpenAI config: ${missing.join(', ')}`);
    }

    const openAIPlaceholders = ['sk-your-api-key-here', 'your_api_key_here'];
    if (openAIPlaceholders.includes(String(config.OPENAI_API_KEY).trim())) {
      throw new Error('OPENAI_API_KEY is still a placeholder. Update it in .env before running grading.');
    }

    // Validate API key format
    if (!config.OPENAI_API_KEY.startsWith('sk-')) {
      logger.warn('OpenAI API key might be invalid (should start with "sk-")');
    }

    return true;
  }

  /**
   * Sleep function untuk delay
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry function dengan exponential backoff
   */
  static async retry(fn, maxRetries = 3, initialDelay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          logger.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, error.message);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Format score untuk display
   */
  static formatScore(score, maxScore = 100) {
    const percentage = ((score / maxScore) * 100).toFixed(1);
    return `${score}/${maxScore} (${percentage}%)`;
  }

  /**
   * Get letter grade dari numeric score
   */
  static getLetterGrade(score, maxScore = 100) {
    const percentage = (Number(score) / Number(maxScore)) * 100;
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    if (percentage >= 50) return 'E';
    return 'F';
  }

  /**
   * Generate summary report
   */
  static generateSummaryReport(results, startTime, endTime) {
    const stats = this.calculateStatistics(results);
    const duration = (endTime - startTime) / 1000 / 60; // minutes

    const summary = {
      timestamp: new Date().toISOString(),
      duration: {
        seconds: Math.round((endTime - startTime) / 1000),
        minutes: Math.round(duration),
        hours: (duration / 60).toFixed(2)
      },
      statistics: stats,
      results: results
    };

    return summary;
  }
}

module.exports = GradingUtils;
