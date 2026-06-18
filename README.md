# 📚 Moodle Essay Auto-Grader

Sistem otomasi penilaian essay di Moodle menggunakan **Puppeteer** (browser automation) dan **OpenAI GPT** (AI evaluation). Dirancang untuk menilai ratusan essay dalam hitungan jam dengan AI yang konsisten.

**Status:** ✅ Production Ready  
**Tested for:** 2,430 essays (486 students × 5 questions)  
**Avg Time:** 6-8 hours (GPT-3.5) / 4-6 hours (GPT-4)

---

## 🎯 Features

✅ **Fully Automated** - Login, scrape essays, evaluate, submit grades  
✅ **AI-Powered Grading** - Menggunakan OpenAI GPT-4/GPT-3.5 untuk penilaian  
✅ **Checkpoint & Resume** - Otomatis save progress, bisa resume dari checkpoint  
✅ **Detailed Feedback** - Skor + reasoning + strengths + improvements  
✅ **Comprehensive Logging** - Track semua activities dan errors  
✅ **CSV Export** - Generate report CSV untuk import ke spreadsheet  
✅ **Customizable Rubric** - Support custom rubric penilaian  
✅ **Error Handling** - Retry logic dengan exponential backoff  
✅ **Rate Limiting Aware** - Smart delays untuk avoid blocking  

---

## 🚀 Quick Start Guide - Moodle Essay Auto-Grader

> Panduan GitHub step-by-step ada di `GITHUB_SETUP.md`.

## ⚡ Setup dalam 5 Menit

### 1️⃣ Install Dependencies
```bash
npm install
npx puppeteer install
```

### 2️⃣ Copy & Edit Configuration
```bash
copy .env.example .env
```

Lalu edit `.env` sesuai akun Moodle dan OpenAI.

**Total waktu setup:** ~5 menit  
**Waktu grading:** Tergantung jumlah submissions (lihat estimasi di bawah)

---

## 📊 Performance & Cost

### Untuk 2,430 Essays (486 × 5)

| Model | Time | Cost | Quality | Recommended |
|---|---|---|---|---|
| **GPT-3.5** | 4-5 hours | $2-3 | Good | ⭐ Budget |
| **GPT-4-Turbo** | 6-8 hours | $8-12 | Better | ⭐ Best |
| **GPT-4** | 10-12 hours | $25-30 | Best | ✓ Quality |

### Configuration yang direkomendasikan:

**Budget Friendly (4-5 jam, $2-3):**
```env
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=300
CONCURRENT_REQUESTS=5
RETRY_DELAY_MS=500
```

**Balanced (6-8 jam, $8-12):** ⭐ RECOMMENDED
```env
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=500
CONCURRENT_REQUESTS=3
RETRY_DELAY_MS=1000
```

**Best Quality (10-12 jam, $25-30):**
```env
OPENAI_MODEL=gpt-4
OPENAI_MAX_TOKENS=800
CONCURRENT_REQUESTS=2
RETRY_DELAY_MS=2000
```

---

## 📁 Project Structure

```
moodle-essay-auto-grader/
│
├── index.js                    # Main script (basic version)
├── gradeEssaysAdvanced.js      # Advanced script dengan checkpoint
│
├── moodleBot.js                # Puppeteer Moodle automation
├── essayEvaluator.js           # OpenAI API integration
├── gradingUtils.js             # Utility functions
├── logger.js                   # Winston logger setup
│
├── package.json                # Dependencies
├── .env.example                # Configuration template
├── .env.detailed               # Detailed config guide
│
├── rubric.json                 # Penilaian rubric (customizable)
│
├── SETUP_GUIDE.md              # Detailed setup & troubleshooting
├── QUICK_START.md              # Quick reference guide
├── README.md                   # File ini
│
├── logs/                       # Log files
│   ├── combined.log           # All activities
│   ├── error.log              # Errors only
│   └── grading.log            # Grading results
│
├── results/                    # Output files
│   ├── report-<timestamp>.json # Full report
│   └── report-<timestamp>.csv  # CSV export
│
├── checkpoints/                # Resume checkpoints
│   └── grading-checkpoint.json
│
└── backups/                    # Backup files
    └── backup-<timestamp>.json
```

---

## 📋 Prerequisites

### System Requirements
- **Node.js:** v16 atau lebih tinggi
- **RAM:** Minimum 4GB (8GB recommended)
- **Storage:** 10GB untuk logs dan results
- **Network:** Stable internet connection

### Accounts & Credentials
- **Moodle:** Admin/Teacher account dengan akses assignment grading
- **OpenAI:** API key dengan sufficient credit
  - GPT-3.5 price: ~$0.0005 per submission
  - GPT-4 price: ~$0.03 per submission

### Information Needed
- Moodle URL (cth: https://moodle.universitas.ac.id)
- Moodle username & password
- Course ID (dari URL: course/view.php?id=X)
- Assignment ID (dari URL: mod/assign/view.php?id=Y)
- OpenAI API Key

---

## 🔧 Configuration

### Environment Variables (.env)

| Variable | Description | Required |
|---|---|---|
| `MOODLE_URL` | Moodle domain | ✅ |
| `MOODLE_USERNAME` | Login username | ✅ |
| `MOODLE_PASSWORD` | Login password | ✅ |
| `MOODLE_COURSE_ID` | Course ID | ✅ |
| `MOODLE_ASSIGNMENT_ID` | Assignment ID | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | ✅ |
| `OPENAI_MODEL` | Model (gpt-4, gpt-3.5-turbo) | ❌ |
| `RETRY_DELAY_MS` | Delay between submissions | ❌ |
| `LOG_LEVEL` | Log verbosity | ❌ |

Untuk detail lengkap, lihat **SETUP_GUIDE.md** atau **.env.detailed**

---

## 📖 Usage

### Basic Usage
```bash
npm start
```

### Advanced Usage (dengan checkpoint)
```bash
npm run grade
```

### Monitoring
```bash
# Terminal 1: Run grading
npm start

# Terminal 2: Monitor progress
Get-Content logs/combined.log -Wait

# Terminal 3: Monitor errors
Get-Content logs/error.log -Wait
```

### Output
- **Grades** → Langsung tersubmit ke Moodle
- **Report** → `results/report-<timestamp>.json` (JSON format)
- **CSV Export** → `results/report-<timestamp>.csv` (untuk import)
- **Logs** → `logs/` folder (for debugging)

---

## 🎓 Use Cases

### 1. Single Assignment
```bash
MOODLE_ASSIGNMENT_ID=15 npm start
```

### 2. Multiple Assignments (Sequential)
```bash
# Grade 5 assignments
for id in 15 16 17 18 19; do
  MOODLE_ASSIGNMENT_ID=$id npm start
done
```

### 3. Custom Rubric
```bash
# 1. Edit rubric.json
# 2. Edit essayEvaluator.js untuk pakai rubric
# 3. npm start
```

### 4. Dry Run (test dengan 5 submissions)
```bash
# Edit index.js, ubah submissions loop:
const testSubmissions = submissions.slice(0, 5);
npm start
```

---

## 🔍 How It Works

```
┌─────────────────────────────────────────────────────┐
│  1. Browser Automation (Puppeteer)                 │
├─────────────────────────────────────────────────────┤
│  - Login ke Moodle                                  │
│  - Navigate ke assignment grading page              │
│  - Scrape semua student submissions                │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  2. AI Evaluation (OpenAI GPT)                     │
├─────────────────────────────────────────────────────┤
│  - Untuk tiap essay:                               │
│    • Send essay ke OpenAI API                      │
│    • OpenAI mengevaluasi & return score (0-100)   │
│    • Generate feedback (reasoning, strengths, etc) │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  3. Grade Submission (Puppeteer)                   │
├─────────────────────────────────────────────────────┤
│  - Submit score ke Moodle                          │
│  - Add feedback ke submission                      │
│  - Continue ke submission berikutnya               │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  4. Report Generation                              │
├─────────────────────────────────────────────────────┤
│  - Generate JSON report                            │
│  - Export CSV untuk spreadsheet                    │
│  - Log semua activities                            │
└─────────────────────────────────────────────────────┘
```

---

## ⚙️ Customization

### Custom AI Prompt
Edit **essayEvaluator.js** method `buildPrompt()`:
```javascript
buildPrompt(essay, question, rubric = null) {
  // Customize prompt sesuai kebutuhan penilaian Anda
  let prompt = `...your custom prompt...`;
  return prompt;
}
```

### Custom Rubric
Edit **rubric.json** dengan kriteria penilaian Anda:
```json
{
  "rubrics": [
    {
      "questionId": 1,
      "question": "Your question here",
      "criteria": [
        {
          "name": "Aspect 1",
          "weight": 40,
          "descriptors": { ... }
        }
      ]
    }
  ]
}
```

### Custom Feedback Format
Edit **gradeEssaysAdvanced.js** method `generateFeedback()`:
```javascript
generateFeedback(score, evaluation) {
  // Customize feedback format
  let feedback = `...your format...`;
  return feedback;
}
```

---

## 🐛 Troubleshooting

### Common Issues & Solutions

**Q: Login failed**
- Check MOODLE_URL format (no trailing slash)
- Verify username/password
- Test login manually ke Moodle first

**Q: "Failed to launch browser"**
```bash
npx puppeteer install
npm install --save puppeteer@latest
```

**Q: "Invalid OpenAI API key"**
- Get new key dari https://platform.openai.com/api-keys
- Check quota di dashboard
- Ensure key starts dengan "sk-"

**Q: "Timeout waiting for..."**
```env
TIMEOUT_MS=60000
CONCURRENT_REQUESTS=1
```

**Q: Resume dari checkpoint**
- Script otomatis load checkpoint jika ada
- Jalankan `npm start` ulang

Untuk troubleshooting lengkap, lihat **SETUP_GUIDE.md**

---

## 📊 Output Example

### Report JSON
```json
{
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "courseId": 3,
    "assignmentId": 15,
    "model": "gpt-4"
  },
  "summary": {
    "minutes": 120,
    "hours": 2.0
  },
  "statistics": {
    "totalGraded": 486,
    "averageScore": "78.50",
    "scoreDistribution": {
      "A (90-100)": 120,
      "B (80-89)": 180,
      "C (70-79)": 140,
      ...
    }
  },
  "results": [ ... ]
}
```

### CSV Export
```csv
Student Name,Student ID,Score,Status,Evaluation
"Andi Wijaya",12345,85,success,"Clear explanation with good examples"
"Budi Santoso",12346,72,success,"Adequate but missing some details"
...
```

---

## 🔐 Security

### Best Practices
- ✅ Add `.env` ke `.gitignore`
- ✅ Never commit credentials
- ✅ Use environment variables di production
- ✅ Restrict file permissions: `chmod 600 .env`
- ✅ Rotate API keys regularly
- ✅ Use separate API keys untuk different environments

---

## 📞 Support & Debugging

### Enable Debug Mode
```env
LOG_LEVEL=debug
```

### Collect Debug Info
```bash
npm list > debug_info.txt
node --version >> debug_info.txt
tail -100 logs/error.log >> debug_info.txt
```

---

## 📚 Additional Resources

- [OpenAI Documentation](https://platform.openai.com/docs)
- [Puppeteer Documentation](https://pptr.dev)
- [Moodle Web Services API](https://docs.moodle.org/dev/Web_service_API_functions)
- [Node.js Documentation](https://nodejs.org/docs)
- [GitHub Setup Guide](./GITHUB_SETUP.md)
- [Contributing Guide](./CONTRIBUTING.md)

---

## 📝 License

MIT License - Feel free to use and modify

---

## 👨‍💻 Contributing

Issues, suggestions, dan pull requests are welcome!

---

## 📞 Contact

Untuk pertanyaan atau issues, silakan:
1. Check **SETUP_GUIDE.md** untuk troubleshooting
2. Check **QUICK_START.md** untuk quick reference
3. Enable debug mode untuk detailed logging
4. Collect debug info sebelum contact support

---

**Happy Grading! 🎓**

---

## Changelog

### v1.0.0 (Current)
- ✅ Basic grading automation
- ✅ Checkpoint & resume support
- ✅ Detailed logging
- ✅ CSV export
- ✅ Error handling & retry logic

### Future Features
- [ ] 2FA support untuk Moodle
- [ ] PDF essay support dengan OCR
- [ ] Multiple assignment batch processing
- [ ] Email notifications
- [ ] Web dashboard untuk monitoring
- [ ] Database integration untuk history
