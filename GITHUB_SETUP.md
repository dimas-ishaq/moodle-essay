# Panduan GitHub untuk Moodle Essay Auto-Grader

Dokumen ini berisi langkah paling mudah untuk menghubungkan project ke GitHub.

## 1) Siapkan repository lokal

Jika belum ada Git, jalankan:
```bash
git init
```

Cek status:
```bash
git status
```

## 2) Tambahkan file yang aman

Pastikan file sensitif tidak ikut tersimpan.

Buat atau cek file `.gitignore` berisi:
```gitignore
.env
.env.*
logs/
results/
backups/
checkpoints/
node_modules/
```

## 3) Buat repository di GitHub

1. Login ke GitHub.
2. Klik **New repository**.
3. Isi nama repository, misalnya:
   `moodle-essay-auto-grader`
4. Jangan centang inisialisasi README jika project ini sudah punya README.
5. Klik **Create repository**.

## 4) Hubungkan repository lokal ke GitHub

Setelah repository GitHub dibuat, jalankan:
```bash
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
```

Cek remote:
```bash
git remote -v
```

## 5) Commit pertama

Tambahkan file:
```bash
git add .
```

Commit:
```bash
git commit -m "Initial commit"
```

Push ke GitHub:
```bash
git branch -M main
git push -u origin main
```

## 6) Alur kerja harian

Saat ada perubahan:
```bash
git status
git add .
git commit -m "Deskripsi perubahan"
git push
```

## 7) Cara aman sebelum push

Sebelum push, pastikan:
- file `.env` tidak ikut ter-commit
- log lama tidak ikut masuk
- kredensial tetap hanya di lokal

Cek cepat:
```bash
git status
```

## 8) Jika muncul error umum

### Error: remote already exists
```bash
git remote set-url origin https://github.com/USERNAME/NAMA-REPO.git
```

### Error: belum set user identity
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email@anda.com"
```

### Error: push ditolak karena branch beda
```bash
git pull --rebase origin main
git push
```

## 9) Struktur file yang disarankan di GitHub

Yang aman untuk commit:
- file `.js`
- file `.md`
- `package.json`
- `package-lock.json`
- `.env.example`
- `rubric.json`

Yang jangan di-commit:
- `.env`
- `logs/`
- `results/`
- `backups/`
- `checkpoints/`
- `node_modules/`

## 10) Ringkasan langkah cepat

```bash
git init
git remote add origin https://github.com/USERNAME/NAMA-REPO.git
git add .
git commit -m "Initial commit"
git branch -M main
git push -u origin main
```

## 11) Setelah push pertama

Buka repository GitHub, pastikan:
- file tampil benar
- README terbaca
- `.env` tidak ikut muncul

Selesai.
