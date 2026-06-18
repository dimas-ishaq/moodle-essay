# Moodle Essay Auto-Grader - Panduan Setup & Penggunaan

## 📋 Daftar Isi
1. [Persyaratan Sistem](#persyaratan-sistem)
2. [Instalasi](#instalasi)
3. [Konfigurasi](#konfigurasi)
4. [Penggunaan](#penggunaan)
5. [Troubleshooting](#troubleshooting)
6. [Tips & Best Practices](#tips--best-practices)

---

## Persyaratan Sistem

### Hardware
- **RAM**: Minimum 4GB (8GB recommended untuk 2000+ submissions)
- **Storage**: 10GB untuk logs dan hasil grading
- **CPU**: Intel i5 atau lebih baik

### Software
- **Node.js**: v16 atau lebih tinggi
- **npm**: v8 atau lebih tinggi
- **Moodle**: v3.9 atau lebih tinggi
- **Browser**: Chrome/Chromium (untuk Puppeteer)

### Akun & API
- **Moodle**: Akun admin atau teacher dengan akses assignment grading
- **OpenAI API**: GPT-4 access dengan credit yang cukup

---

## Instalasi

### 1. Clone atau Download Project
```bash
cd moodle-essay-auto-grader
```

### 2. Install Dependencies
```bash
npm install
```

**Penjelasan dependencies:**
- `puppeteer`: Browser automation (untuk scrape & submit di Moodle)
- `openai`: OpenAI API client (untuk evaluasi essay)
- `dotenv`: Environment variable management
- `winston`: Logging system
- `axios`: HTTP client (jika diperlukan)

### 3. Install Chromium Browser (untuk Puppeteer)
```bash
npx puppeteer install
```

---

## Konfigurasi

### 1. Setup Environment Variables
```bash
# Copy template
cp .env.example .env

# Edit .env dengan editor favorit Anda
nano .env
# atau
code .env
```

### 2. Konfigurasi Moodle

**Dapatkan MOODLE_COURSE_ID:**
```
1. Login ke Moodle
2. Buka course yang ingin dinilai
3. Lihat URL: https://your-moodle.com/course/view.php?id=X
4. X adalah COURSE_ID
```

**Dapatkan MOODLE_ASSIGNMENT_ID:**
```
1. Buka assignment/quiz yang ingin dinilai
2. Lihat URL: https://your-moodle.com/mod/assign/view.php?id=X
3. X adalah ASSIGNMENT_ID
```

**Contoh .env lengkap:**
```env
# Moodle Configuration
MOODLE_URL=https://learning.universitas.ac.id/moodle
MOODLE_USERNAME=admin_user
MOODLE_PASSWORD=secure_password_here
MOODLE_COURSE_ID=5
MOODLE_ASSIGNMENT_ID=28

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=500

# Performance
BATCH_SIZE=10
CONCURRENT_REQUESTS=3
TIMEOUT_MS=30000
RETRY_DELAY_MS=2000
MAX_RETRIES=3

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/grading.log
```

### 3. Persiapan Rubric (Opsional)

Jika ingin custom rubric, edit `rubric.json`:
```json
{
  "rubrics": [
    {
      "questionId": 1,
      "question": "Pertanyaan soal",
      "criteria": [
        {
          "name": "Aspek penilaian",
          "weight": 40,
          "descriptors": {
            "excellent": "Deskripsi kategori excellent",
            "good": "...",
            "satisfactory": "...",
            "poor": "...",
            "failing": "..."
          }
        }
      ]
    }
  ]
}
```

---

## Penggunaan

### Cara 1: Langsung Menjalankan
```bash
npm start
```

### Cara 2: Dengan Nodemon (Development)
```bash
npx nodemon index.js
```

### Contoh Output
```
2024-01-15 10:30:45 [INFO]: Browser launched successfully
2024-01-15 10:30:52 [INFO]: Login successful
2024-01-15 10:30:58 [INFO]: Found 150 submissions to grade
2024-01-15 10:31:02 [INFO]: [1/150] Processing submission from Andi Wijaya...
2024-01-15 10:31:15 [INFO]: [1/150] Successfully graded Andi Wijaya: 85/100
...
============================================================
GRADING SUMMARY
============================================================
Total Submissions: 150
Successfully Graded: 150
Failed: 0
Average Score: 78.50/100
Duration: 45.32 minutes
============================================================
```

---

## Troubleshooting

### Error: "Login failed"
**Solusi:**
- Pastikan URL Moodle benar (tanpa trailing slash)
- Cek username/password
- Periksa jika ada 2FA di Moodle (perlu customization)
- Test login manual ke Moodle

### Error: "Failed to launch browser"
**Solusi:**
```bash
# Reinstall Chromium
npx puppeteer install

# Jika masih error, gunakan sistem Chrome yang sudah ada:
# Edit moodleBot.js, ubah launch() menjadi:
this.browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', // Path Chrome system
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

### Error: "OPENAI_API_KEY not valid"
**Solusi:**
- Pastikan API key dari https://platform.openai.com/api-keys
- Cek quota/credit di dashboard OpenAI
- Gunakan GPT-3.5 jika budget terbatas: `OPENAI_MODEL=gpt-3.5-turbo`

### Error: "Timeout waiting for submission"
**Solusi:**
```bash
# Naikkan timeout di .env
TIMEOUT_MS=60000  # 60 detik

# Atau kurangi concurrent requests
CONCURRENT_REQUESTS=1
```

### Error: "JSON parse error from OpenAI"
**Solusi:**
- OpenAI API response format berubah
- Update library: `npm install --save openai@latest`
- Cek format prompt di `essayEvaluator.js`

### Memory leak setelah berjalan lama
**Solusi:**
- Set `--max-old-space-size` saat jalankan:
```bash
node --max-old-space-size=4096 index.js
```

---

## Tips & Best Practices

### 1. Testing Sebelum Full Run
```bash
# Edit index.js, ubah submissions.length menjadi submissions.slice(0, 5)
# untuk test hanya 5 submissions

const submissions = await this.moodleBot.getEssaySubmissions(...);
console.log('Testing mode - limiting to 5 submissions');
for (let submission of submissions.slice(0, 5)) {
  // ... process
}
```

### 2. Cost Optimization
```env
# Gunakan GPT-3.5 untuk cost lebih murah
OPENAI_MODEL=gpt-3.5-turbo
OPENAI_TEMPERATURE=0.2  # Lower = more consistent

# Batasi tokens
OPENAI_MAX_TOKENS=300  # Kurangi dari default 500
```

### 3. Monitoring Progress Real-time
```bash
# Terminal 1 - Jalankan script
npm start

# Terminal 2 - Monitor log file
tail -f logs/combined.log

# Terminal 3 - Monitor error log
tail -f logs/error.log
```

### 4. Batch Processing untuk 2000+ Essays
```bash
# Bagi submissions menjadi beberapa batch
# Edit index.js untuk menambah checkpoint saving

const CHECKPOINT_INTERVAL = 50;  // Save setiap 50 submissions
```

### 5. Restart jika Error (Auto-Resume)
```javascript
// Di dalam index.js, tambahkan:
const lastProcessedId = await loadLastCheckpoint();
const submissions = await this.moodleBot.getEssaySubmissions(...);
const remaining = submissions.filter(s => s.id > lastProcessedId);

for (let submission of remaining) {
  // ... process
  saveCheckpoint(submission.id);
}
```

### 6. Custom AI Prompt
Edit `essayEvaluator.js` method `buildPrompt()`:
```javascript
buildPrompt(essay, question, rubric = null) {
  let prompt = `Custom prompt untuk penilaian spesifik Anda...
  
  Pertanyaan: ${question}
  Essay: ${essay}
  
  Sesuaikan dengan kebutuhan penilaian.`;
  
  return prompt;
}
```

---

## Performance Metrics

### Untuk 2,430 Essays (486 × 5)

| Configuration | Time | Cost (OpenAI) | Notes |
|---|---|---|---|
| GPT-4, 1 concurrent | ~20 hours | ~$25-30 | Reliable, slow |
| GPT-4, 3 concurrent | ~8 hours | ~$25-30 | Recommended |
| GPT-3.5, 5 concurrent | ~4 hours | ~$2-3 | Budget-friendly |
| GPT-3.5, 10 concurrent | ~2 hours | ~$2-3 | Risk rate limiting |

### Rekomendasi Setup untuk 2,430 essays:
```env
OPENAI_MODEL=gpt-3.5-turbo
CONCURRENT_REQUESTS=3
RETRY_DELAY_MS=1000
```
Perkiraan waktu: **6-8 jam, Cost: ~$2-4**

---

## FAQ

**Q: Bisakah saya pause dan resume?**
A: Ya, tambahkan checkpoint system di index.js

**Q: Bagaimana jika ada submission error?**
A: Script akan log dan lanjut ke submission berikutnya. Lihat error.log untuk details

**Q: Bisa grade langsung tanpa simpan ke Moodle?**
A: Ya, edit index.js untuk skip `submitGrade()` step

**Q: Gimana handle multiple questions?**
A: Buat separate assignment di Moodle untuk tiap question, atau modify loop untuk iterate questions

---

## Support & Debugging

### Aktifkan Debug Mode
```env
LOG_LEVEL=debug
```

### Collect Debug Info
```bash
# Buat file info system
npm list
node --version
npm --version

# Save dalam debug_info.txt
echo "Debug Info" > debug_info.txt
npm list >> debug_info.txt
node --version >> debug_info.txt
```

### Contact Support
Include dalam report:
- Error message lengkap
- Environment config (tanpa credentials)
- debug_info.txt
- Relevant log excerpts dari logs/error.log
