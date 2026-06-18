# 📦 Project Files Index & Summary

## Halaman ini menjelaskan semua files yang ada di project dan bagaimana menggunakannya.

---

## 📄 Documentation Files

### 1. **README.md** ⭐ START HERE
**Deskripsi:** Overview lengkap project  
**Gunakan untuk:** Memahami apa project ini, features, dan cara kerjanya  
**Waktu baca:** 10 menit

**Berisi:**
- Project overview & features
- Quick start (3 langkah)
- Performance & cost estimation
- Project structure
- How it works (diagram)
- Troubleshooting quick reference

---

### 2. **QUICK_START.md** ⭐ UNTUK MULAI CEPAT
**Deskripsi:** Quick reference guide & cheat sheet  
**Gunakan untuk:** Setup cepat dan common scenarios  
**Waktu baca:** 5 menit

**Berisi:**
- 5-minute setup checklist
- Configuration reference
- Cost estimation
- Common scenarios & solutions
- Output files explanation
- Quick troubleshooting

---

### 3. **SETUP_GUIDE.md** ⭐ UNTUK DETAIL LENGKAP
**Deskripsi:** Comprehensive setup guide dengan troubleshooting detail  
**Gunakan untuk:** Setup yang detail, troubleshooting, best practices  
**Waktu baca:** 20 menit (skimming), 45 menit (detail)

**Berisi:**
- System requirements detail
- Step-by-step installation
- Configuration guide lengkap
- Cara dapat Course ID & Assignment ID
- Custom rubric setup
- Performance metrics & recommendations
- Detailed troubleshooting
- Tips & best practices
- FAQ

---

## 🔧 Configuration Files

### 4. **.env.example**
**Deskripsi:** Template environment variables  
**Gunakan:** Copy ke `.env` dan edit dengan nilai Anda  
**Penting:** JANGAN edit file ini - copy ke `.env` terlebih dahulu

```bash
cp .env.example .env
# Edit .env dengan nilai sebenarnya
```

---

### 5. **.env.detailed**
**Deskripsi:** Detailed configuration guide dengan explanation tiap variable  
**Gunakan:** Sebagai reference saat mengisi `.env`  
**Berisi:**
- Explanation untuk tiap variable
- Contoh value
- Tips untuk optimization
- Recommended configurations
- Security notes

---

### 6. **rubric.json**
**Deskripsi:** Template penilaian rubric (customizable)  
**Gunakan:** Jika ingin custom rubric dengan kriteria spesifik  
**Format:** JSON dengan structure:
```json
{
  "rubrics": [
    {
      "questionId": 1,
      "question": "...",
      "criteria": [...]
    }
  ]
}
```

---

## 📝 Main Scripts

### 7. **package.json**
**Deskripsi:** Node.js project configuration  
**Gunakan:** `npm install` akan baca file ini untuk install dependencies  
**Berisi:**
- Project metadata
- Dependencies list
- npm scripts shortcuts

---

### 8. **index.js** (Basic Version)
**Deskripsi:** Main grading automation script (basic)  
**Gunakan:** `npm start` untuk menjalankan grading  
**Fitur:**
- Simple & straightforward
- Auto login ke Moodle
- Scrape submissions
- Evaluate dengan OpenAI
- Submit grades ke Moodle
- Generate report

**Jalankan dengan:**
```bash
npm start
```

---

### 9. **gradeEssaysAdvanced.js** (Advanced Version)
**Deskripsi:** Advanced grading script dengan checkpoint & resume  
**Gunakan:** Untuk 1000+ submissions atau jika ada risk of interruption  
**Fitur:**
- Checkpoint system (auto-save progress)
- Resume capability (lanjut dari mana stop)
- Batch processing dengan progress tracking
- Detailed reporting
- Statistics calculation
- Backup creation

**Jalankan dengan:**
```bash
node gradeEssaysAdvanced.js
```

**Perbedaan dengan index.js:**
| Feature | index.js | gradeEssaysAdvanced.js |
|---|---|---|
| Checkpoint | ❌ | ✅ |
| Resume | ❌ | ✅ |
| Progress tracking | Basic | Detailed |
| Error handling | Standard | Enhanced |
| Statistics | Simple | Comprehensive |
| Recommended untuk | <500 submissions | 500+ submissions |

---

## 🔌 Core Modules

### 10. **moodleBot.js**
**Deskripsi:** Puppeteer automation untuk Moodle  
**Gunakan:** Tidak perlu dijalankan langsung, di-use oleh main scripts  
**Berisi:**
- Browser launch & login
- Get submissions list
- Open submission untuk grading
- Submit grade & feedback ke Moodle

**Key Methods:**
```javascript
async launch()              // Start browser
async login()              // Login ke Moodle
async getEssaySubmissions() // Scrape submissions
async openSubmissionForGrading() // Open submission
async submitGrade()        // Submit grade ke Moodle
async close()              // Close browser
```

---

### 11. **essayEvaluator.js**
**Deskripsi:** OpenAI API integration untuk evaluate essays  
**Gunakan:** Tidak perlu dijalankan langsung, di-use oleh main scripts  
**Berisi:**
- OpenAI API client initialization
- Prompt builder (customizable)
- Essay evaluation dengan GPT
- Response parsing & validation
- Retry logic untuk error handling

**Key Methods:**
```javascript
async evaluateEssay(essay, question, rubric)
async evaluateBatch(essayData, rubric)
```

---

### 12. **gradingUtils.js**
**Deskripsi:** Utility functions untuk grading operations  
**Gunakan:** Tidak perlu dijalankan langsung, di-use oleh main scripts  
**Berisi:**
- Checkpoint save/load
- Rubric loading
- Score validation & formatting
- Statistics calculation
- CSV report generation
- Configuration validation

**Key Methods:**
```javascript
static loadRubric()        // Load rubric dari file
static saveCheckpoint()    // Save progress
static validateScore()     // Validate score range
static calculateStatistics() // Hitung statistik
static generateCSVReport() // Export ke CSV
// ... dan banyak lagi
```

---

### 13. **logger.js**
**Deskripsi:** Winston logging configuration  
**Gunakan:** Tidak perlu dijalankan langsung, di-use oleh scripts untuk logging  
**Berisi:**
- Console & file logging
- Log levels (error, warn, info, debug)
- Multiple log files (combined, error, grading)

---

## 📊 Output & Generated Files

### Setelah menjalankan grading, akan dibuat:

#### **results/** folder
```
results/
├── report-1705326600000.json    # Full report (JSON)
└── report-1705326600000.csv     # Grades export (CSV)
```

**report.json** - Berisi:
- Metadata (timestamp, course ID, model used)
- Summary (duration, start/end time)
- Statistics (average, median, distribution)
- Detailed results (per-student scores & feedback)

**report.csv** - Format:
```csv
Student Name,Student ID,Score,Status,Evaluation,Timestamp
```

---

#### **logs/** folder
```
logs/
├── combined.log      # Semua activities
├── error.log        # Errors only
└── grading.log      # Grading results
```

**combined.log** - All activities dengan timestamp  
**error.log** - Errors untuk debugging  
**grading.log** - Grading results dalam JSON format

---

#### **checkpoints/** folder (Advanced script only)
```
checkpoints/
└── grading-checkpoint.json    # Auto-save progress untuk resume
```

---

#### **backups/** folder (Advanced script only)
```
backups/
└── backup-2024-01-15T10-30-45-000Z.json    # Backup sebelum grading
```

---

## 🚀 Workflow Diagram

```
START
  ↓
[Copy & Edit Files]
  ├─ cp .env.example .env
  ├─ Edit .env dengan credentials
  └─ (Optional) Edit rubric.json
  ↓
[Install & Setup]
  ├─ npm install
  ├─ npx puppeteer install
  └─ Verify .env configuration
  ↓
[Run Grading]
  ├─ npm start (basic)
  └─ node gradeEssaysAdvanced.js (advanced)
  ↓
[Monitor Progress]
  ├─ tail -f logs/combined.log
  └─ tail -f logs/error.log
  ↓
[Check Results]
  ├─ results/report-*.json (detailed)
  ├─ results/report-*.csv (import-ready)
  ├─ logs/grading.log (all grades)
  └─ Verify di Moodle
  ↓
END ✓
```

---

## 📖 How to Use This Project

### Step 1: Read Documentation (15 menit)
1. Read **README.md** - paham project
2. Skim **QUICK_START.md** - untuk overview
3. Keep **SETUP_GUIDE.md** nearby - untuk reference

### Step 2: Setup Configuration (10 menit)
1. Copy `.env.example` ke `.env`
2. Edit `.env` dengan Moodle credentials & OpenAI key
3. Verify nilai benar dengan cross-check di `.env.detailed`

### Step 3: Install Dependencies (5 menit)
```bash
npm install
npx puppeteer install
```

### Step 4: Test dengan 5 Submissions (5 menit)
```bash
# Edit index.js, ubah submissions.length ke submissions.slice(0, 5)
npm start
```

### Step 5: Review & Adjust (10 menit)
1. Cek hasil di Moodle
2. Review output di `results/` folder
3. Adjust rubric atau prompt jika diperlukan

### Step 6: Full Run (N jam tergantung konfigurasi)
```bash
# Restore index.js ke normal
npm start
# Atau gunakan advanced script
node gradeEssaysAdvanced.js
```

---

## 🎯 Which File to Edit?

### Jika ingin...

**Mengubah configuration:**
- Edit: `.env`
- Reference: `.env.detailed`

**Mengubah penilaian criteria:**
- Edit: `rubric.json`
- Reference: SETUP_GUIDE.md (Persiapan Rubric section)

**Mengubah AI prompt/instruction:**
- Edit: `essayEvaluator.js` (method `buildPrompt()`)
- Reference: OpenAI documentation

**Mengubah feedback format:**
- Edit: `gradeEssaysAdvanced.js` (method `generateFeedback()`)
- Reference: SETUP_GUIDE.md

**Menambah custom logic:**
- Edit: `index.js` atau `gradeEssaysAdvanced.js`
- Use utilities dari: `gradingUtils.js`

**Debug/troubleshooting:**
- Check: `logs/` folder
- Enable: `LOG_LEVEL=debug` di `.env`

---

## 📱 File Summary Table

| File | Type | Purpose | Edit? | Required |
|---|---|---|---|---|
| README.md | Docs | Project overview | ❌ | Read |
| QUICK_START.md | Docs | Quick reference | ❌ | Skim |
| SETUP_GUIDE.md | Docs | Detailed guide | ❌ | Reference |
| .env.example | Config | Template | ❌ | Copy |
| .env | Config | Active config | ✅ | Edit |
| .env.detailed | Docs | Config guide | ❌ | Reference |
| rubric.json | Config | Grading rubric | ✅ | Optional |
| package.json | Config | Dependencies | ❌ | For npm |
| index.js | Script | Basic grading | ✅ | Run |
| gradeEssaysAdvanced.js | Script | Advanced grading | ✅ | Optional |
| moodleBot.js | Module | Moodle automation | ✅ | Code |
| essayEvaluator.js | Module | OpenAI integration | ✅ | Code |
| gradingUtils.js | Module | Utilities | ❌ | Library |
| logger.js | Module | Logging | ❌ | Library |

---

## ⚡ Common Commands

```bash
# Setup
npm install
npx puppeteer install

# Running
npm start                           # Basic grading
node gradeEssaysAdvanced.js        # Advanced with checkpoint

# Monitoring
tail -f logs/combined.log          # All activities
tail -f logs/error.log             # Errors only
tail -f logs/grading.log           # Grading results

# Testing
npm test                           # (if implemented)

# Cleaning
rm -rf logs/*                      # Clear logs
rm -rf results/*                   # Clear results
rm checkpoints/grading-checkpoint.json  # Reset checkpoint
```

---

## 🆘 Quick Help

**Lupa Course ID?**
- Login ke Moodle → Buka course → URL: `course/view.php?id=X`

**Lupa Assignment ID?**
- Buka assignment → URL: `mod/assign/view.php?id=Y`

**Lupa OpenAI API Key?**
- Pergi ke https://platform.openai.com/api-keys

**Script error saat running?**
- Check: `logs/error.log`
- Set: `LOG_LEVEL=debug` untuk detail
- Read: SETUP_GUIDE.md troubleshooting section

**Script timeout?**
- Increase: `TIMEOUT_MS=60000`
- Decrease: `CONCURRENT_REQUESTS=1`

**Script lambat?**
- Use: `OPENAI_MODEL=gpt-3.5-turbo`
- Increase: `CONCURRENT_REQUESTS=5`
- Decrease: `OPENAI_MAX_TOKENS=300`

---

## ✅ Checklist sebelum mulai

- [ ] Baca README.md
- [ ] Punya Moodle credentials (username/password)
- [ ] Punya OpenAI API key
- [ ] Tahu Course ID & Assignment ID
- [ ] Install Node.js v16+
- [ ] Download/clone project ini
- [ ] Copy .env.example ke .env
- [ ] Edit .env dengan nilai benar
- [ ] Jalankan: `npm install`
- [ ] Jalankan: `npx puppeteer install`
- [ ] Test dengan 5 submissions dulu
- [ ] Review hasil sebelum full run
- [ ] Run full batch grading

---

## 🎓 Next Steps

1. **START:** Read README.md (5 min)
2. **SETUP:** Follow SETUP_GUIDE.md or QUICK_START.md (10 min)
3. **CONFIG:** Edit .env dan optional files (5 min)
4. **INSTALL:** npm install (1 min)
5. **TEST:** Run dengan 5 submissions (5 min)
6. **REVIEW:** Check hasil di Moodle & logs (10 min)
7. **RUN:** Jalankan full grading (N jam)
8. **ANALYZE:** Review final report (10 min)

**Total time:** ~45 menit setup + N jam grading

---

**Happy Grading! 🎓📚**

Jika ada pertanyaan, cek dokumentasi atau enable debug mode.
