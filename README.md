# Localan

> Antarmuka obrolan AI desktop & web berdesain modern *liquid glass*, bertenaga [Ollama](https://ollama.com/) lokal, serta dilengkapi modul penghapusan latar belakang gambar (*Background Removal*) lokal bertenaga hardware Anda sendiri (NVIDIA CUDA / CPU). 100% privat, cepat, dan tanpa ketergantungan cloud.

---

## Fitur Utama

- **100% Offline & Privat**: Semua inferensi model AI (Ollama) dan pemrosesan citra (Rembg) dijalankan secara lokal di komputer Anda. Tidak ada data chat, file, atau gambar yang dikirim ke server cloud pihak ketiga.
- **Dukungan Multi-Model & Tool Calling**: Terintegrasi langsung dengan API Ollama lokal, mendukung pergantian model *on-the-fly*, streaming respons, indikator *thinking*, dan eksekusi tool calling terstruktur.
- **Modul Hapus Background Gambar Studio**: Antarmuka khusus dengan dropzone batch, antrean pemrosesan sekuensial, slider perbandingan visual interaktif (*before / after*), dan auto-save ke folder kerja.
- **Manajemen Memori GPU Cerdas**: Skrip server `run_rembg.py` membatasi alokasi VRAM maksimal 2048 MB (2 GB) dengan kebijakan *Single Active Model* dan *Auto CPU Fallback* otomatis bila memori grafis habis.
- **Akses Sistem Berkas Ganda**:
  - Di browser: Menggunakan W3C File System Access API.
  - Di desktop: Menggunakan Native File System API bawaan Tauri v2.
- **Desain Liquid Glass & Dark Palette**: Estetika warm dark charcoal (`#140a07`), panel kaca transparan (*glassmorphism*), tipografi tajam (Geist & Manrope), dan transisi halus berbasis Motion.

---

## Prasyarat Sistem

1. **Node.js**: Versi 20 LTS atau lebih baru.
2. **Ollama**: Terinstal dan berjalan di latar belakang (`http://127.0.0.1:11434`).
   - Unduh model yang diinginkan via terminal:
     ```bash
     ollama pull qwen2.5:7b
     ```
3. **Microsoft Edge WebView2**: Terbawa secara default di Windows 10/11.
4. **Rust & Cargo** (Hanya jika menjalankan atau mem-build aplikasi desktop Tauri):
   - [Instalasi Rust](https://www.rust-lang.org/tools/install) (versi 1.90+ disarankan).
5. **Python 3.10 – 3.13** (Opsional, untuk modul Background Removal):
   - Diperlukan pustaka: `rembg`, `fastapi`, `uvicorn`, `onnxruntime` (atau `onnxruntime-gpu` untuk akselerasi CUDA).
   ```bash
   pip install rembg[gpu] fastapi uvicorn asyncer aiohttp
   ```

---

## Panduan Menjalankan

### 1. Mode Web (Browser)

```bash
# Pasang dependensi
npm install

# Jalankan server development Vite
npm run dev
```
Buka peramban di `http://localhost:5173`. Vite secara otomatis menyediakan proxy balik untuk Ollama di `/api/ollama` dan server rembg di `/api/rembg`.

### 2. Mode Desktop (Tauri v2)

```bash
# Jalankan aplikasi desktop dalam mode development
npm run tauri dev
```

### 3. Membangun Installer Desktop Windows

```bash
# Menghasilkan installer .msi dan .exe
npm run tauri build
```
Berkas installer hasil build akan tersimpan di:
- `src-tauri/target/release/bundle/nsis/Local Chat_0.1.1_x64-setup.exe`
- `src-tauri/target/release/bundle/msi/Local Chat_0.1.1_x64_en-US.msi`

---

## Menjalankan Server Background Removal (rembg)

Server background removal dapat dijalankan secara independen:

- **Cara 1 (Batch Script Windows):**
  Klik ganda berkas `start_rembg.bat` di root direktori. Skrip ini secara otomatis mendeteksi Python di virtualenv `.venv` atau di `PATH` sistem dan menjalankan server pada port `7000` dengan batas VRAM 2 GB.
- **Cara 2 (Perintah npm):**
  ```bash
  npm run rembg
  ```

---

## Catatan Penting

### 1. Perbedaan Origin & Penyimpanan Riwayat Chat
- Penyimpanan lokal (IndexedDB) di browser beroperasi pada origin `http://localhost:5173`.
- Pada aplikasi desktop Tauri (Windows WebView2), aplikasi berjalan di origin kustom (`http://asset.localhost` / `http://ipc.localhost`).
- **Konsekuensi:** Riwayat chat yang dibuat di versi browser **tidak otomatis berpindah** ke aplikasi desktop karena isolasi *Same-Origin Policy* pada IndexedDB browser.
- **Solusi Pemindahan Data:** Gunakan fitur **Ekspor (ZIP / JSON)** pada menu aplikasi browser, lalu buka atau sambungkan folder kerja tersebut di aplikasi desktop.

### 2. Status Penandatanganan Installer (Code Signing)
- Paket instalasi (`.exe` dan `.msi`) yang dihasilkan dari repositori ini berstatus **Unsigned (Tidak ditandatangani dengan sertifikat digital komersial)**.
- Saat pertama kali menginstal di Windows, Anda mungkin akan melihat peringatan **Windows SmartScreen** (*"Windows protected your PC"*).
- **Langkah:** Klik tautan **"More info"**, lalu klik tombol **"Run anyway"** untuk melanjutkan instalasi.

### 3. Fitur Devtools di Cargo
Secara *default*, fitur `devtools` WebView2 dimatikan pada build produksi demi keamanan dan performa. Jika Anda ingin mengaktifkan devtools saat menguji coba build desktop:
```bash
npm run tauri build -- --features devtools
```

---

## Pengujian Otomatis

Repositori ini menyertakan *test suite* mandiri untuk memverifikasi logika filesystem engine dan tool calling:

```bash
# Menjalankan pengujian folder tools & normalisasi EOL (LF/CRLF)
npm test

# Menjalankan skenario tool-calling Ollama (memerlukan Ollama berjalan)
node tests/test_models_scenarios.mjs
```

---

## Atribusi & Lisensi Pihak Ketiga

Proyek ini dibangun menggunakan pustaka sumber terbuka berikut:

| Pustaka / Komponen | Lisensi | Kegunaan |
|---|---|---|
| [React](https://react.dev/) | MIT | Antarmuka Pengguna Komponen |
| [Vite](https://vite.dev/) | MIT | Frontend Build Tool & Dev Server |
| [Tauri v2](https://tauri.app/) | MIT / Apache-2.0 | Desktop App Runtime & Windows WebView2 Bridge |
| [Tailwind CSS v4](https://tailwindcss.com/) | MIT | Styling & Design Tokens |
| [Motion](https://motion.dev/) | MIT | Animasi & Transisi Visual |
| [liquid-glass-react](https://github.com/liquid-glass) | MIT | Efek Kaca Refraktif (*Glassmorphism*) |
| [Lucide Icons](https://lucide.dev/) | ISC | Ikonografi Antarmuka |
| [Ollama JavaScript SDK](https://github.com/ollama/ollama-js) | MIT | Klien API Ollama |
| [fflate](https://github.com/101arrowz/fflate) | MIT | Ekspor dan Kompresi ZIP Riwayat Chat |
| [Font Geist](https://vercel.com/font) | SIL Open Font License 1.1 | Tipografi UI Modern |
| [Font Manrope](https://gent.media/manrope) | SIL Open Font License 1.1 | Tipografi Teks Utama |
| [rembg](https://github.com/danielgatis/rembg) | MIT | Library Penghapusan Latar Belakang Citra |

---

## Lisensi

Proyek ini dilisensikan di bawah **[MIT License](LICENSE)** &copy; 2026 VoidNimm.
