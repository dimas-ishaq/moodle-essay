# 🚀 Quick Start Guide - Moodle Essay Auto-Grader

## ⚡ Setup dalam 5 Menit

### 1️⃣ Install Dependencies
```bash
npm install
npx puppeteer install
```

### 2️⃣ Copy & Edit Configuration
```bash
copy .env.example .env
# Edit .env dengan editor teks Anda, isi:
# - MOODLE_URL, USERNAME, PASSWORD
# - MOODLE_COURSE_ID, MOODLE_ASSIGNMENT_ID  
# - OPENAI_API_KEY
```

### 3️⃣ Jalankan Script
```bash
npm start
```

### 4️⃣ Jalankan mode advanced jika perlu checkpoint/resume
```bash
npm run grade
```

**Itu saja!** Script akan mulai grading secara otomatis.

---

## 📋 Checklist Pre-Grading

Sebelum menjalankan, pastikan:

- [ ] Sudah login ke Moodle dan akses course yang ingin dinilai
- [ ] Tahu course ID dan assignment ID
- [ ] Punya OpenAI API key dengan credit cukup
- [ ] Sudah install Node.js v16+
- [ ] File `.env` sudah diisi dengan config yang benar

---

## 🎯 Common Scenarios & Solutions

### Scenario 1: Test dengan 5 submissions terlebih dahulu
```bash
# Edit index.js, ubah line submissions loop:
const testSubmissions = submissions.slice(0, 5);
for (let submission of testSubmissions) {
  // ... process
}
```

### Scenario 2: Resume jika terjadi error tengah jalan
```bash
# Script akan otomatis resume dari checkpoint
# Jalankan ulang:
npm run grade
```

### Scenario 3: Gunakan budget OpenAI lebih murah
```bash
# Edit .env:
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=300
```

### Scenario 4: Custom prompt/rubric
```bash
# Edit essayEvaluator.js atau rubric.json
# dengan kriteria penilaian spesifik Anda
```

### Scenario 5: Monitor progress real-time
```bash
# Terminal 1: Jalankan script
npm start

# Terminal 2: Monitor log
Get-Content logs/combined.log -Wait
```

---

## 📊 Output Files

Setelah selesai, cek folder:

```
results/
  ├── report-<timestamp>.json    ← Report lengkap (JSON)
  └── report-<timestamp>.csv     ← Grade untuk import ke spreadsheet
  
logs/
  ├── combined.log               ← All activities
  ├── error.log                  ← Errors only
  └── grading.log                ← Grading results
  
checkpoints/
  └── grading-checkpoint.json    ← Auto-resume point
```

---

## ⚙️ Configuration Reference

| Variable | Description | Example | Required |
|---|---|---|---|
| `MOODLE_URL` | Moodle domain | `https://moodle.univ.ac.id` | ✅ |
| `MOODLE_USERNAME` | Login username | `admin` | ✅ |
| `MOODLE_PASSWORD` | Login password | `secret123` | ✅ |
| `MOODLE_COURSE_ID` | Course ID | `5` | ✅ |
| `MOODLE_ASSIGNMENT_ID` | Assignment ID | `28` | ✅ |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-xxx` | ✅ |
| `OPENAI_MODEL` | Model to use | `gpt-4` | ❌ (default: gpt-4) |
| `OPENAI_TEMPERATURE` | Response consistency | `0.3` | ❌ |
| `RETRY_DELAY_MS` | Delay between submissions | `1000` | ❌ |
| `LOG_LEVEL` | Logging verbosity | `info` | ❌ |

---

## 💰 Cost Estimation

Untuk **2.430 essays** (486 × 5):

| Model | Time | Estimated Cost | Notes |
|---|---|---|---|
| **GPT-4** | 8-10 hours | $25-30 | Better quality |
| **GPT-3.5** | 4-6 hours | $2-4 | Budget friendly ⭐ |
| **Mix** | 6-8 hours | $8-12 | Balanced |

**Recommendation untuk 2430 essays:**
```env
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=300
RETRY_DELAY_MS=500
```
Estimate: **5-6 jam, Cost: ~$3-4**

---

## 🔧 Troubleshooting Quick Fixes

### ❌ "Login failed"
```
→ Check MOODLE_URL, USERNAME, PASSWORD
→ Try login manually ke Moodle terlebih dahulu
→ Cek jika ada 2FA di Moodle (butuh custom code)
```

### ❌ "Failed to launch browser"
```bash
→ npx puppeteer install
→ Atau: npm install --save puppeteer@latest
```

### ❌ "Invalid OpenAI API key"
```
→ Get new key dari https://platform.openai.com/api-keys
→ Check credit di dashboard
→ Make sure key starts dengan "sk-"
```

### ❌ "Timeout waiting for..."
```env
→ TIMEOUT_MS=60000  (increase timeout)
→ CONCURRENT_REQUESTS=1  (reduce concurrency)
```

### ❌ "JSON parse error"
```
→ npm install --save openai@latest
→ Check format prompt di essayEvaluator.js
```

---

## 📈 Performance Tips

### Untuk kecepatan:
```env
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.1
RETRY_DELAY_MS=300
```

### Untuk akurasi:
```env
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.3
```

### Untuk budget:
```env
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_MAX_TOKENS=200
CONCURRENT_REQUESTS=5
```

---

## 🔍 Debug Mode

### Enable full logging:
```env
LOG_LEVEL=debug
```

### Check what's happening:
```bash
# Terminal 1
npm start

# Terminal 2
Get-Content logs/error.log -Wait

# Terminal 3
Get-Content logs/combined.log -Wait
```

---

## 📞 Getting Help

### Error message dengan solution:
```
ERROR: "Connection refused"
→ Moodle URL tidak accessible
→ Check network/VPN
→ Check URL format (no trailing slash)

ERROR: "Invalid grade value"
→ OpenAI returning non-numeric score
→ Check rubric format
→ Re-run, usually temporary error

ERROR: "Submission tidak ditemukan"
→ Student belum submit
→ Assignment ID salah
→ Check Moodle manually
```

### Collect info jika minta bantuan:
```bash
npm list > debug_info.txt
node --version >> debug_info.txt
# Remove sensitive data before sharing .env contents
Get-Content logs/error.log -Tail 100 >> debug_info.txt
```

---

## 📝 Usage Examples

### Example 1: Grade 1 specific assignment
```bash
npm start
# Check hasil di results/ folder
```

### Example 2: Grade multiple assignments
```bash
# Jalankan script berkali-kali dengan different MOODLE_ASSIGNMENT_ID
MOODLE_ASSIGNMENT_ID=28 npm start
MOODLE_ASSIGNMENT_ID=29 npm start
MOODLE_ASSIGNMENT_ID=30 npm start
```

### Example 3: Grade dengan custom criteria
```bash
# 1. Edit rubric.json dengan criteria Anda
# 2. Edit essayEvaluator.js untuk pakai rubric
# 3. npm start
```

---

## ✅ Verification Checklist

Setelah grading selesai:

- [ ] Semua submissions punya grade di Moodle
- [ ] Report file ada di `results/` folder
- [ ] Log file mencatat semua activities
- [ ] No error di `logs/error.log`
- [ ] Average score reasonable untuk class Anda

---

## 🎓 For Educators

### Rekomendasi penggunaan:
1. **Test dulu** dengan 5-10 submissions
2. **Review hasil** - cek kualitas grading
3. **Adjust rubric** jika perlu
4. **Run full batch** pada 486 submissions
5. **Export grades** ke spreadsheet untuk backup

### Tips:
- Gunakan lebih deskriptif question/criteria untuk AI
- Review few random grades untuk ensure quality
- Set rubric yang clear sesuai learning objectives
- Keep backup dari original submissions

---

## 📚 Additional Resources

- OpenAI Docs: https://platform.openai.com/docs
- Puppeteer Docs: https://pptr.dev
- Moodle API: https://docs.moodle.org/dev/Web_service_API_functions
- Node.js: https://nodejs.org/docs

---

**Happy Grading! 🎓**

Jika ada pertanyaan atau issue, silakan cek logs dan gunakan debug mode.
