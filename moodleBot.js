const puppeteer = require('puppeteer');
const logger = require('./logger');

class MoodleBot {
  constructor(config) {
    this.config = config;
    this.browser = null;
    this.page = null;
  }

  async launch() {
    try {
      logger.info('Launching browser...');
      this.browser = await puppeteer.launch({
        headless: "new",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
      this.page = await this.browser.newPage();

      // Set user agent untuk menghindari blocking
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      );

      // Set viewport
      await this.page.setViewport({ width: 1280, height: 720 });

      logger.info('Browser launched successfully');
    } catch (error) {
      logger.error('Failed to launch browser:', error);
      throw error;
    }
  }

  async login() {
    try {
      logger.info(`Attempting login to ${this.config.MOODLE_URL}`);

      await this.page.goto(`${this.config.MOODLE_URL}/login/index.php`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.waitForSelector('#username', { timeout: 15000 });
      await this.page.waitForSelector('#password', { timeout: 15000 });

      await this.page.$eval('#username', (el, value) => {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, this.config.MOODLE_USERNAME);

      await this.page.$eval('#password', (el, value) => {
        el.focus();
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, this.config.MOODLE_PASSWORD);

      const submitted = await this.page.evaluate(() => {
        const form = document.querySelector('form');
        if (!form) return false;

        const submitButton = form.querySelector('button[type="submit"], input[type="submit"], #loginbtn');
        if (submitButton && typeof submitButton.click === 'function') {
          submitButton.click();
          return true;
        }

        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          return true;
        }

        form.submit();
        return true;
      });

      if (!submitted) {
        await this.page.keyboard.press('Enter');
      }

      await this.page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      logger.info('Login successful');
      return true;
    } catch (error) {
      logger.error('Login failed:', error);
      throw error;
    }
  }

  async getEssaySubmissions(courseId, assignmentId) {
    return this.getQuizAttempts(courseId, assignmentId);
  }

  async getQuizQuestions(quizId) {
    try {
      logger.info(`Fetching quiz questions from quiz ${quizId}`);

      const quizUrl = `${this.config.MOODLE_URL}/mod/quiz/view.php?id=${quizId}`;
      await this.page.goto(quizUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const quizTitle = await this.page.evaluate(() => {
        const titleNode = document.querySelector('h1, .page-header-headings h1, #page-header h1');
        return titleNode ? titleNode.textContent.trim() : '';
      });

      const questions = await this.page.evaluate(() => {
        const questionNodes = Array.from(document.querySelectorAll('.que, .question, .formulation'));
        return questionNodes
          .map((node, index) => {
            const text = node.innerText?.trim() || '';
            return text ? { index: index + 1, text } : null;
          })
          .filter(Boolean);
      });

      logger.info(`Found ${questions.length} quiz question blocks`);
      return { quizId, quizTitle, questions };
    } catch (error) {
      logger.error(`Failed to fetch quiz questions for quiz ${quizId}:`, error);
      throw error;
    }
  }

  async getQuizAttempts(courseId, quizId) {
    try {
      logger.info(`Fetching quiz attempts from course ${courseId}, quiz ${quizId}`);

      const groupId = String(this.config.GROUP_ID || '').trim();
      const groupQuery = groupId ? `&group=${encodeURIComponent(groupId)}` : '';
      const attemptsUrl = `${this.config.MOODLE_URL}/mod/quiz/report.php?id=${quizId}&mode=overview${groupQuery}`;
      await this.page.goto(attemptsUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const attempts = await this.page.evaluate((regradeAgain, regradeThreshold) => {
        const links = Array.from(document.querySelectorAll('a[href*="/mod/quiz/review.php?attempt="]'));
        const allowRegrade = String(regradeAgain || 'false').toLowerCase() === 'true';
        const threshold = Number.parseFloat(regradeThreshold);

        const parseVisibleScore = (text) => {
          const normalized = String(text || '').replace(',', '.').trim();
          const match = normalized.match(/^\d+(?:\.\d+)?$/) || normalized.match(/\d+(?:\.\d+)?/);
          return match ? parseFloat(match[0]) : NaN;
        };

        const extractRowScores = (cells) => {
          const values = [];
          for (const cell of cells) {
            const normalized = String(cell || '').replace(/,/g, '.');
            const matches = normalized.match(/\d+(?:\.\d+)?/g) || [];
            for (const match of matches) {
              const value = parseFloat(match);
              if (Number.isFinite(value)) values.push(value);
            }
          }
          return values;
        };

        console.log('[getQuizAttempts] review links found:', links.length);

        return links
          .map((link, index) => {
            const href = link.href || '';
            const attemptId = new URL(href).searchParams.get('attempt');
            if (!attemptId) return null;

            const row = link.closest('tr');
            const cells = row ? Array.from(row.querySelectorAll('td')).map(cell => (cell.innerText || cell.textContent || '').trim()) : [];
            const linkText = (link.innerText || link.textContent || '').trim();
            const anchorScore = parseVisibleScore(linkText);
            const rowScores = extractRowScores(cells);
            const rowScore = rowScores.length > 0 ? rowScores[rowScores.length - 1] : NaN;
            const currentScore = Number.isFinite(rowScore) ? rowScore : anchorScore;
            const statusText = linkText || 'Ungraded';
            const isUngraded = /belum dinilai|Not yet graded/i.test(statusText);
            const eligibleForRegrade = allowRegrade
              ? Number.isFinite(currentScore) && Number.isFinite(threshold) && currentScore < threshold
              : isUngraded;

            console.log('[getQuizAttempts] comparison:', JSON.stringify({
              attemptId,
              visibleScore: Number.isFinite(anchorScore) ? anchorScore : null,
              rowScore: Number.isFinite(rowScore) ? rowScore : null,
              currentScore: Number.isFinite(currentScore) ? currentScore : null,
              threshold: Number.isFinite(threshold) ? threshold : null,
              regradeAgain: allowRegrade,
              eligibleForRegrade,
              decision: eligibleForRegrade ? 'selected' : 'skipped'
            }));

            return {
              rowIndex: index + 1,
              studentName: cells[0] || 'Unknown',
              status: statusText,
              attemptId,
              rawLink: href,
              cells,
              regradeAgain: allowRegrade,
              regradeThreshold: Number.isFinite(threshold) ? threshold : null,
              currentScore: Number.isFinite(currentScore) ? currentScore : null,
              allScores: rowScores,
              eligibleForRegrade
            };
          })
          .filter(Boolean);
      }, this.config.REGRADE_AGAIN || false, this.config.REGRADE_THRESHOLD || 40);

      logger.info(`Found ${attempts.length} quiz attempts`);
      attempts.slice(0, 5).forEach((attempt, index) => {
        logger.info(`Attempt sample ${index + 1}: ${JSON.stringify(attempt)}`);
      });

      logger.info(`Found ${attempts.length} ungraded quiz attempts`);
      attempts.slice(0, 5).forEach((attempt, index) => {
        logger.info(`Ungraded sample ${index + 1}: ${JSON.stringify(attempt)}`);
      });

      return attempts;
    } catch (error) {
      logger.error(`Failed to get quiz attempts:`, error);
      throw error;
    }
  }

  async getQuizSlots(attemptId, maxSlots = 5) {
    return Array.from({ length: maxSlots }, (_, i) => i + 1).map(slot => ({ attemptId, slot }));
  }

  async openQuizSlot(attemptId, slot) {
    try {
      const url = `${this.config.MOODLE_URL}/mod/quiz/comment.php?attempt=${attemptId}&slot=${slot}`;
      await this.page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await this.page.waitForSelector('.qtext, .answer, input[name$="-mark"]', { timeout: 15000 });

      const content = await this.page.evaluate(() => {
        const normalize = (text) => (text || '').replace(/\s+/g, ' ').trim();
        const qtextNode = document.querySelector('.qtext');
        const answerNode = document.querySelector('.answer');
        const markInput = document.querySelector('input[type="text"][name$="-mark"]');
        return {
          questionText: normalize(qtextNode ? qtextNode.innerText : ''),
          answerText: normalize(answerNode ? answerNode.innerText : ''),
          markName: markInput ? markInput.getAttribute('name') : ''
        };
      });

      return content;
    } catch (error) {
      logger.error(`Failed to open quiz slot ${slot} for attempt ${attemptId}:`, error);
      throw error;
    }
  }

  async submitSlotMark(mark, feedback = '') {
    try {
      const normalizedFeedback = String(feedback || '').trim();
      if (!normalizedFeedback) {
        throw new Error('Feedback comment is empty; stopping before score submission');
      }

      const commentSelector = 'div[contenteditable="true"][role="textbox"]';
      const commentHtml = `<p dir="ltr" style="text-align: left;">${normalizedFeedback}</p>`;

      const commentSet = await this.page.evaluate(({ selector, html }) => {
        const editor = document.querySelector(selector);
        if (!editor) return false;

        editor.focus();
        editor.innerHTML = html;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: html }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        editor.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }, { selector: commentSelector, html: commentHtml });

      if (commentSet) {
        logger.info('Feedback comment filled before score submission');
      } else {
        throw new Error('Feedback comment editor not found before score submission');
      }

      await new Promise(resolve => setTimeout(resolve, 3000));

      const markSelector = 'input[type="text"][name$="-mark"]';
      await this.page.waitForSelector(markSelector, { timeout: 10000 });

      const markString = Number(mark).toFixed(2);
      await this.page.$eval(markSelector, (el, value) => {
        el.focus();
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }, markString);

      const currentValue = await this.page.$eval(markSelector, el => el.value);
      if (Number(currentValue).toFixed(2) !== markString) {
        throw new Error(`Failed to set mark input value. Expected ${markString}, got ${currentValue}`);
      }

      const submitted = await this.page.evaluate(() => {
        const form = document.querySelector('form');
        if (!form) return false;

        const button = form.querySelector('#id_submitbutton, button[type="submit"], input[type="submit"]');
        if (button && typeof button.click === 'function') {
          button.click();
          return true;
        }

        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          return true;
        }

        form.submit();
        return true;
      });

      if (!submitted) {
        throw new Error('Failed to submit mark form');
      }

      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      return true;
    } catch (error) {
      logger.error('Failed to submit slot mark:', error);
      throw error;
    }
  }

  async openSubmissionForGrading(quizId, attemptIdOrUserId) {
    try {
      const url = `${this.config.MOODLE_URL}/mod/quiz/review.php?attempt=${attemptIdOrUserId}`;
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.waitForSelector('.que, .question, .formulation', { timeout: 10000 });

      const content = await this.page.evaluate(() => {
        const extractText = (selectors) => {
          for (const selector of selectors) {
            const node = document.querySelector(selector);
            if (node && node.innerText.trim()) return node.innerText.trim();
          }
          return '';
        };

        const questionBlocks = Array.from(document.querySelectorAll('.que, .question'));
        const answers = [];

        questionBlocks.forEach((block, index) => {
          const qText = (block.querySelector('.qtext, .formulation, .content, .questiontext')?.innerText || block.innerText || '').trim();
          const answerText = Array.from(block.querySelectorAll('.answer, textarea, input[type="text"], input[type="radio"]:checked, input[type="checkbox"]:checked'))
            .map(el => (el.innerText || el.value || el.getAttribute('value') || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
          answers.push({
            index: index + 1,
            question: qText,
            answer: answerText
          });
        });

        return {
          pageTitle: extractText(['h1', '.page-header-headings h1', '#page-header h1']),
          answerText: answers.map(item => item.answer).join('\n\n').trim(),
          questions: answers
        };
      });

      return content;
    } catch (error) {
      logger.error(`Failed to open quiz attempt ${attemptIdOrUserId}:`, error);
      throw error;
    }
  }

  async openSubmissionForGrading(quizId, attemptId) {
    try {
      const url = `${this.config.MOODLE_URL}/mod/quiz/review.php?attempt=${attemptId}`;
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      await this.page.waitForSelector('.que, .question, .formulation', { timeout: 10000 });

      const content = await this.page.evaluate(() => {
        const extractText = (selectors) => {
          for (const selector of selectors) {
            const node = document.querySelector(selector);
            if (node && node.innerText.trim()) return node.innerText.trim();
          }
          return '';
        };

        const questionBlocks = Array.from(document.querySelectorAll('.que, .question'));
        const answers = [];

        questionBlocks.forEach((block, index) => {
          const qText = (block.querySelector('.qtext, .formulation, .content, .questiontext')?.innerText || block.innerText || '').trim();
          const answerText = Array.from(block.querySelectorAll('.answer, textarea, input[type="text"], input[type="radio"]:checked, input[type="checkbox"]:checked'))
            .map(el => (el.innerText || el.value || el.getAttribute('value') || '').trim())
            .filter(Boolean)
            .join(' ')
            .trim();
          answers.push({
            index: index + 1,
            question: qText,
            answer: answerText
          });
        });

        return {
          pageTitle: extractText(['h1', '.page-header-headings h1', '#page-header h1']),
          answerText: answers.map(item => item.answer).join('\n\n').trim(),
          questions: answers
        };
      });

      return content;
    } catch (error) {
      logger.error(`Failed to open quiz attempt ${attemptId}:`, error);
      throw error;
    }
  }

  async submitGrade(quizId, attemptId, grade, feedback = '') {
    try {
      const commentSelector = 'div[contenteditable="true"][role="textbox"]';
      const normalizedFeedback = String(feedback || '').trim();
      const commentHtml = `<p dir="ltr" style="text-align: left;">${normalizedFeedback || '&nbsp;'}</p>`;

      const commentSet = await this.page.evaluate(({ selector, html }) => {
        const editor = document.querySelector(selector);
        if (!editor) return false;

        editor.focus();
        editor.innerHTML = html;
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: html }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        editor.dispatchEvent(new Event('blur', { bubbles: true }));
        return true;
      }, { selector: commentSelector, html: commentHtml });

      if (commentSet) {
        logger.info(`Comment filled for attempt ${attemptId}`);
      } else {
        logger.warn(`Comment editor not found for attempt ${attemptId}`);
      }

      const markSelector = 'input[type="text"][name$="-mark"]';
      await this.page.waitForSelector(markSelector, { timeout: 10000 });
      const markString = Number(grade).toFixed(2);
      await this.page.$eval(markSelector, (el, value) => {
        el.focus();
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
      }, markString);

      const submitted = await this.page.evaluate(() => {
        const form = document.querySelector('form');
        if (!form) return false;

        const submitButton = form.querySelector('button[type="submit"], input[type="submit"], #id_submitbutton');
        if (submitButton && typeof submitButton.click === 'function') {
          submitButton.click();
          return true;
        }

        if (typeof form.requestSubmit === 'function') {
          form.requestSubmit();
          return true;
        }

        form.submit();
        return true;
      });

      if (!submitted) {
        throw new Error('Failed to submit grading form');
      }

      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
      logger.info(`Quiz grading submitted for attempt ${attemptId}`);
      return true;
    } catch (error) {
      logger.error(`Failed to submit grade for attempt ${attemptId}:`, error);
      throw error;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      logger.info('Browser closed');
    }
  }
}

module.exports = MoodleBot;
