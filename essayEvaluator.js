const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const logger = require('./logger');

class EssayEvaluator {
  constructor(apiKeyOrConfig, model = 'gpt-4', baseURL = '') {
    const config = typeof apiKeyOrConfig === 'object' && apiKeyOrConfig !== null
      ? apiKeyOrConfig
      : {
        OPENAI_API_KEY: apiKeyOrConfig,
        OPENAI_MODEL: model,
        OPENAI_BASE_URL: baseURL
      };

    const clientOptions = { apiKey: config.OPENAI_API_KEY };
    if (config.OPENAI_BASE_URL && String(config.OPENAI_BASE_URL).trim()) {
      clientOptions.baseURL = String(config.OPENAI_BASE_URL).trim();
    }

    this.client = new OpenAI(clientOptions);
    this.model = config.OPENAI_MODEL || model;
    this.config = config;
  }

  loadRubricGuide(rubricGuidePath = './rubric.md') {
    try {
      if (!rubricGuidePath || !fs.existsSync(rubricGuidePath)) {
        return '';
      }

      return fs.readFileSync(rubricGuidePath, 'utf-8').trim();
    } catch (error) {
      logger.warn(`Failed to load rubric guide from ${rubricGuidePath}: ${error.message}`);
      return '';
    }
  }

  buildPrompt(question, answer, rubric = null) {
    const minPoints = Number.isFinite(Number(this.config.MIN_POINTS)) ? Number(this.config.MIN_POINTS) : 0;
    const maxPoints = Number.isFinite(Number(this.config.MAX_POINTS)) ? Number(this.config.MAX_POINTS) : 12;
    const emptyScore = Number.isFinite(Number(this.config.EMPTY_SCORE)) ? Number(this.config.EMPTY_SCORE) : minPoints;
    const rubricEnabled = String(this.config.RUBRIC_ENABLED ?? 'false').toLowerCase() === 'true';
    const subject = String(this.config.SUBJECT || 'Umum').trim();
    const phase = String(this.config.PHASE || 'Umum').trim();
    const grade = String(this.config.GRADE || 'Umum').trim();
    const questionType = String(this.config.QUESTION_TYPE || 'Essay').trim();
    const rubricGuidePath = this.config.RUBRIC_GUIDE_FILE || './rubric.md';
    const rubricGuide = this.loadRubricGuide(rubricGuidePath);

    let prompt = `Kamu adalah guru profesional Kurikulum Merdeka yang berpengalaman menilai jawaban siswa pada berbagai mata pelajaran dan jenjang pendidikan.

TUJUAN

Menilai jawaban siswa secara adil, objektif, konsisten, dan mendidik berdasarkan:

* Kesesuaian dengan soal
* Ketepatan isi
* Pemahaman konsep
* Logika atau alasan yang diberikan
* Kelengkapan jawaban
* Kejelasan penyampaian
* Panjang jawaban yang tetap relevan dan bermakna

BOBOT BONUS LEMAH

Gunakan bonus kecil jika jawaban menunjukkan:

* Struktur jelas dan runtut: +0.2
* Kelengkapan poin penting: +0.3
* Penjelasan mendalam: +0.4
* Contoh relevan: +0.2
* Istilah atau konsep tepat: +0.2
* Argumen konsisten: +0.2
* Elaborasi tambahan relevan: +0.2
* Kehati-hatian atau koreksi diri: +0.1

Aturan bonus:

- Bonus hanya dipakai kalau isi jawaban benar-benar mendukung pemahaman.
- Jika jawaban panjang tetapi hanya berulang atau berputar-putar, bonus = 0.
- Jika jawaban panjang tetapi kosong substansi, bonus = 0.
- Jika jawaban panjang, relevan, dan memberi tambahan isi yang nyata, berikan bonus kecil.
- Total bonus tidak boleh lebih dari +1.0 dan tidak boleh mengalahkan ketepatan konsep.

SKALA NILAI YANG DIINGINKAN

Pakai rentang nilai berikut sebagai acuan utama:

- 7 = jawaban paling rendah yang masih ada isi, tetapi sangat lemah / hampir tidak tepat
- 8 = jawaban yang masih sedikit sekali relevan, masih ada jejak pemahaman
- 9 = jawaban yang mulai relevan, ada arah jawaban yang benar, tetapi belum lengkap
- 10-11 = jawaban cukup bagus, sudah kuat, lengkap di banyak bagian, tetapi masih ada kekurangan kecil
- 12 = jawaban bagus / sangat bagus, sangat tepat, lengkap, jelas, dan hampir tanpa kekurangan

Jika perlu, gunakan nilai desimal agar lebih akurat, misalnya 7.5, 8.5, 9.5, 10.5, 11.5.

Jika jawaban menunjukkan niat menjawab yang benar, alur pikir yang masuk akal, atau alternatif jawaban yang benar secara makna, naikkan nilai secara wajar meskipun istilah atau formatnya tidak sama dengan kunci.

Jika jawaban masih samar tetapi jelas berusaha menjawab soal, pilih skor yang mencerminkan kemajuan pemahaman, bukan hanya kekurangannya.

PRINSIP PENILAIAN

1. Fokus pada pemahaman siswa, bukan sekadar kecocokan kata demi kata.

2. Jawaban yang menggunakan kalimat berbeda tetapi memiliki makna yang benar harus tetap dihargai.

3. Solusi atau penjelasan alternatif yang benar harus dianggap benar meskipun berbeda dari contoh jawaban.

4. Jangan memberikan nilai tinggi hanya karena jawaban panjang.

5. Jawaban panjang hanya boleh mendapat poin lebih jika isinya tetap relevan, lengkap, dan memperkuat pemahaman.

6. Jawaban singkat dapat memperoleh nilai tinggi apabila tepat dan sesuai dengan soal.

7. Jika ada kesalahan penempatan sintaks, jangan langsung menurunkan nilai terlalu banyak selama poin-poin penting, konsep utama, dan alur jawaban tetap tersampaikan.

8. Kesalahan kecil seperti:

   * typo ringan
   * ejaan
   * tanda baca
   * format penulisan
   * penempatan sintaks yang kurang tepat

   tidak boleh menjadi faktor utama pengurangan nilai.

9. Kesalahan konsep harus lebih berpengaruh terhadap nilai dibanding kesalahan penulisan atau penempatan sintaks.

10. Jika jawaban menunjukkan sebagian pemahaman yang benar, berikan nilai secara proporsional dan boleh memakai desimal jika lebih akurat.

11. Jika jawaban kosong:
   skor = ${emptyScore}

12. Gunakan skor angka dalam rentang:
   ${minPoints}-${maxPoints}

13. Jangan ragu memberi nilai tinggi jika layak.

14. Nilai 12 hanya untuk jawaban yang benar-benar sangat tepat, lengkap, jelas, dan hampir tanpa kekurangan.

15. Nilai 10-11 hanya jika jawaban sudah cukup bagus dan hampir lengkap.

16. Nilai 8-9 untuk jawaban yang masih sedikit sekali relevan, ada usaha memahami soal, tetapi masih belum lengkap.

17. Nilai 6-7 untuk jawaban yang masih nyambung sedikit atau tidak nyambung sama sekali, tetapi masih ada jejak isi yang sangat lemah.

18. Jika jawaban terisi, relevan, dan menunjukkan usaha memahami soal, jangan terlalu pelit menaikkan nilai.

19. Jika isi jawaban sudah nyambung meskipun masih salah sebagian, berikan nilai yang sesuai dengan tingkat pemahamannya.

20. Jika jawaban lebih panjang tetapi tetap relevan, lengkap, dan koheren, berikan bonus nilai kecil dibanding jawaban yang jauh lebih singkat namun sama-sama benar.

21. Bonus karena panjang harus kecil dan tidak boleh mengalahkan akurasi konsep.

22. Jika dua jawaban sama-sama benar, jawaban yang lebih lengkap dan lebih panjang boleh mendapat nilai sedikit lebih tinggi.

23. Jangan terlalu konservatif saat jawaban sudah menunjukkan pemahaman yang jelas.

24. Jika jawaban tidak memakai istilah yang sama dengan kunci, tetapi alur pikirnya benar, niat jawabannya tepat, dan masih nyambung dengan konsep soal, naikkan nilai secara wajar.

25. Jika jawaban masih lemah tetapi sudah menunjukkan arah berpikir yang benar, beri apresiasi nilai kecil agar tidak terlalu rendah.

26. Jika jawaban alternatif benar secara makna meskipun berbeda contoh atau susunan kalimat, perlakukan sebagai jawaban yang layak naik nilai.

27. Jika jawaban masih separuh benar atau sebagian besar arahnya benar, prioritaskan menaikkan nilai ke band yang lebih masuk akal daripada menahannya terlalu rendah.

28. Jika jawaban salah istilah tetapi inti penjelasannya sejalan dengan konsep yang ditanya, anggap itu sebagai jawaban yang masih layak dihargai.

29. Jika jawaban memiliki alasan yang koheren meskipun belum lengkap, berikan nilai lebih tinggi dari sekadar jawaban yang hanya menebak tanpa arah.

30. Untuk jawaban yang masih samar tetapi jelas berusaha menjawab soal, gunakan pendekatan liberal: pilih skor yang mencerminkan kemajuan pemahaman, bukan hanya kekurangannya.

24. Jika jawaban tidak memakai istilah yang sama dengan kunci, tetapi alur pikirnya benar, niat jawabannya tepat, dan masih nyambung dengan konsep soal, naikkan nilai secara wajar.

25. Jika jawaban masih lemah tetapi sudah menunjukkan arah berpikir yang benar, beri apresiasi nilai kecil agar tidak terlalu rendah.

26. Jika jawaban alternatif benar secara makna meskipun berbeda contoh atau susunan kalimat, perlakukan sebagai jawaban yang layak naik nilai.

PROSES PENILAIAN

Langkah 1:
Pahami maksud soal.

Langkah 2:
Analisis jawaban siswa.

Langkah 3:
Bandingkan dengan rubrik jika tersedia.

Langkah 4:
Nilai berdasarkan:

A. Relevansi terhadap soal
B. Ketepatan konsep atau informasi
C. Kelengkapan jawaban
D. Kejelasan penjelasan
E. Kemampuan memberikan alasan atau contoh (jika diperlukan)

PANDUAN UMUM SKOR

* Kosong → ${emptyScore}
* Tidak menjawab pertanyaan → sangat rendah
* Sedikit relevan tetapi masih nyambung → rendah ke sedang
* Sebagian konsep benar atau ada arah jawaban yang masuk akal → sedang
* Mayoritas konsep benar → tinggi
* Sangat tepat dan lengkap → maksimal`;

    if (rubricGuide) {
      prompt += `\n\nPANDUAN RUBRIK PENILAIAN (rubric.md):\n${rubricGuide}`;
    }

    prompt += `\n\nSOAL:\n${question}\n\nJAWABAN SISWA:\n${answer}`;

    if (rubricEnabled && rubric) {
      prompt += `\n\nRUBRIK PENILAIAN:\n${typeof rubric === 'string' ? rubric : JSON.stringify(rubric, null, 2)}`;
    }

    prompt += `\n\nATURAN KOMENTAR

Buat komentar seperti guru yang memberikan umpan balik kepada siswa.

Karakter komentar:

* Ramah
* Mendukung
* Jelas
* Mudah dipahami
* Tidak menghakimi

Komentar harus:

* Menjelaskan kelebihan jawaban
* Menunjukkan bagian yang perlu diperbaiki
* Memberikan motivasi untuk belajar lebih baik
* Mengakui jika jawaban sudah benar sebagian atau sudah punya arah yang tepat
* Tidak melebih-lebihkan kekurangan jika jawaban masih tetap nyambung secara konsep

ATURAN OUTPUT

Balas HANYA dalam format JSON ini:
{
  "score": <integer ${minPoints}-${maxPoints}>,
  "comment": "<komentar singkat, santai, suportif, dan mendidik untuk siswa>",
  "strengths": ["<kekuatan 1>", "<kekuatan 2>"],
  "improvements": ["<area perbaikan 1>", "<area perbaikan 2>"]
}

PANDUAN PENILAIAN TAMBAHAN

* Jika jawaban sudah menunjukkan arah yang benar, komentar harus menyebutkan kemajuan itu.
* Jika jawaban masih separuh benar, komentar harus tetap memberi apresiasi, bukan hanya kritik.
* Jika jawaban alternatif benar secara makna, perlakukan sebagai jawaban yang layak dihargai.

MATA_PELAJARAN: ${subject}
FASE: ${phase}
TINGKAT: ${grade}
JENIS_SOAL: ${questionType}`;

    return prompt;
  }

  async evaluateEssay(essay, question, rubric = null, maxRetries = 3) {
    const minPoints = Number.isFinite(Number(this.config.MIN_POINTS)) ? Number(this.config.MIN_POINTS) : 0;
    const maxPoints = Number.isFinite(Number(this.config.MAX_POINTS)) ? Number(this.config.MAX_POINTS) : 12;
    const emptyScore = Number.isFinite(Number(this.config.EMPTY_SCORE)) ? Number(this.config.EMPTY_SCORE) : minPoints;

    if (!String(essay || '').trim()) {
      logger.info(`Essay evaluated: score=${emptyScore} (empty answer)`);
      return {
        score: emptyScore,
        comment: 'Jawaban kosong',
        reasoning: 'Jawaban kosong',
        strengths: [],
        improvements: ['Jawaban masih kosong, isi terlebih dahulu sesuai soal.']
      };
    }

    let retries = 0;

    while (retries < maxRetries) {
      try {
        const prompt = this.buildPrompt(question, essay, rubric);

        logger.debug(`Sending essay to OpenAI for evaluation...`);

        const response = await this.client.chat.completions.create({
          model: this.model,
          temperature: 0.3,
          max_tokens: 500,
          messages: [
            {
              role: 'system',
              content: `
Kamu adalah evaluator akademik Kurikulum Merdeka.

Tugas:
- Menilai jawaban siswa secara objektif.
- Fokus pada pemahaman konsep.
- Tidak bias terhadap panjang jawaban.
- Menghargai jawaban alternatif yang benar.
- Mengabaikan typo ringan dan kesalahan tanda baca.
- Menghasilkan penilaian yang konsisten.

Balas HANYA JSON valid.
Jangan gunakan markdown.
Jangan menambahkan teks di luar JSON.
`
            },
            {
              role: 'user',
              content: prompt
            }
          ]
        });

        const responseText = response.choices?.[0]?.message?.content || '';

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('Failed to parse JSON response from OpenAI');
        }

        const evaluation = JSON.parse(jsonMatch[0]);
        const score = Number(evaluation.score);

        if (!Number.isFinite(score)) {
          throw new Error(`Invalid score: ${evaluation.score}`);
        }

        const normalizedScore = Math.max(minPoints, Math.min(maxPoints, Math.round(score)));

        logger.info(`Essay evaluated: score=${normalizedScore}`);
        return {
          score: normalizedScore,
          comment: evaluation.comment || evaluation.reasoning || '',
          reasoning: evaluation.comment || evaluation.reasoning || '',
          strengths: evaluation.strengths || [],
          improvements: evaluation.improvements || []
        };
      } catch (error) {
        retries++;
        logger.warn(`Evaluation attempt ${retries}/${maxRetries} failed: ${error.message}`);

        if (retries >= maxRetries) {
          logger.error(`Failed to evaluate essay after ${maxRetries} attempts`);
          throw error;
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  async evaluateBatch(essayData, rubric = null) {
    const results = [];

    for (const data of essayData) {
      try {
        const evaluation = await this.evaluateEssay(data.essay, data.question, rubric);
        results.push({
          studentId: data.studentId,
          studentName: data.studentName,
          score: evaluation.score,
          evaluation: evaluation
        });
      } catch (error) {
        logger.error(`Failed to evaluate essay for ${data.studentName}:`, error);
        results.push({
          studentId: data.studentId,
          studentName: data.studentName,
          score: 0,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = EssayEvaluator;
