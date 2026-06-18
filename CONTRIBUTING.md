# Contributing Guide

Terima kasih ingin berkontribusi ke project ini.

## Alur kerja

1. Buat branch baru.
   ```bash
   git checkout -b feature/nama-fitur
   ```

2. Lakukan perubahan.

3. Jalankan cek dasar.
   ```bash
   npm install
   npm test
   ```

4. Commit perubahan.
   ```bash
   git add .
   git commit -m "Deskripsi perubahan"
   ```

5. Push branch.
   ```bash
   git push -u origin feature/nama-fitur
   ```

6. Buat Pull Request ke `main`.

## Aturan kontribusi

- Jangan commit `.env`.
- Jangan commit log, results, backups, atau checkpoints.
- Gunakan pesan commit yang jelas.
- Jaga perubahan kecil dan fokus.

## Saran perubahan

- Perbaikan bug
- Dokumentasi
- Validasi tambahan
- Peningkatan logging
- Peningkatan keamanan

## Checklist sebelum PR

- [ ] Code berjalan tanpa error
- [ ] `npm test` lolos
- [ ] Dokumentasi diperbarui
- [ ] Tidak ada secret atau credential di commit
