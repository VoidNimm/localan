# PRD: Interface Chat Custom untuk Model Lokal Ollama

Status: draf v0.2 (5 Okt 2026). Desain visual menyusul setelah PRD ini, memakai referensi lewat skill slicing.

Legenda: **\[Keputusan\]** dari kamu, **\[Usulan\]** dari saya, **\[Verifikasi\]** perlu diuji sendiri di laptop kamu.

## 1. Ringkasan

Aplikasi desktop pribadi untuk chat dengan model lokal Ollama. Nilai jual utamanya adalah **desain UI/UX yang menonjol**, dengan efek liquid pada form input dan tombol, plus nama alias AI custom per model.

## 2. Keputusan yang sudah ada

- **\[Keputusan\]** Web app dibungkus Tauri v2 (frontend web, tampil sebagai aplikasi desktop).
- **\[Keputusan\]** Model: `gemma4:e2b`, `gemma4:12b`, `qwen3.5:9b`, masing-masing dengan alias custom.
- **\[Keputusan\]** Desain ditonjolkan; efek liquid di form input dan button.
- **\[Keputusan\]** Urutan: PRD, desain (referensi via skill slicing), implementasi.

## 3. Perangkat target (sumber: file DxDiag yang kamu unggah)

| Komponen | Nilai |
| --- | --- |
| Laptop | HP Victus 16 (16-s1xxx), Windows 11 Home 64-bit |
| CPU | AMD Ryzen 5 8645HS (12 thread) |
| RAM | 16384 MB (tersedia untuk OS: 15678 MB) |
| GPU utama | NVIDIA RTX 4060 Laptop, VRAM dedicated 7956 MB (7956 / 1024 ≈ 7,8 GB) |
| GPU kedua | AMD Radeon 760M (iGPU), Windows melaporkan hybrid graphics |

## 4. Dampak perangkat ke model (sumber ukuran: ollama.com/library/gemma4, /qwen3.5/tags)

| Model | Ukuran file | Konteks | Perkiraan di VRAM 7,8 GB |
| --- | --- | --- | --- |
| gemma4:e2b | 4,6 GB | 128K | Longgar |
| qwen3.5:9b | 6,6 GB | 256K | Muat, tapi sisa ruang untuk KV cache sempit |
| gemma4:12b | 7,7-8,0 GB | 256K | Sangat dekat batas VRAM; sebagian model kemungkinan harus berjalan di RAM/CPU |

Catatan kejujuran: satuan GB vs GiB di listing Ollama tidak bisa saya pastikan, dan kecepatan sebenarnya tidak bisa saya perkirakan dari spesifikasi saja. **\[Verifikasi\]** jalankan tiap model dan cek `ollama ps` (perintah ini ada di docs.ollama.com/faq).

Konsekuensi untuk produk **\[Usulan\]**:

1. **Satu model aktif pada satu waktu.** Jumlah ukuran dua model mana pun (misal 4,6 + 6,6 GB) melebihi VRAM. UI harus punya status "memuat model" saat berganti model.
2. **`num_ctx` default konservatif** (titik awal 8192, bisa diuji naik). Konteks besar menambah pemakaian memori (ai.google.dev/gemma/docs/core). Sediakan slider per model dengan peringatan.
3. **Pengaturan `keep_alive`** per model (contoh parameter ini muncul di docs.openclaw.ai/providers/ollama/recipes) agar model tidak terus memakan VRAM.
4. Ringankan UI: GPU dibagi antara inferensi dan rendering efek liquid, jadi efek harus punya mode hemat.

## 5. Fitur MVP

1. **Registry alias** (config JSON): `ollama_id`, `alias`, `avatar`, `warna`, `system_prompt`, `peran`. Alias hanya di UI. **\[Usulan\]**
2. **Chat streaming** dan pergantian model per percakapan.
3. **Toggle thinking** per model + blok thinking yang bisa dilipat. Default thinking Qwen3.5 di Ollama tidak bisa saya pastikan (sumber bertentangan). **\[Verifikasi\]**
4. **Upload gambar** (ketiga model menerima gambar).
5. **Pengaturan model:** `num_ctx`, `keep_alive`, system prompt.
6. **Riwayat percakapan lokal.**
7. **Status Ollama** (terhubung/tidak, model terpasang, model aktif).

Di luar MVP: tool calling (ada laporan GitHub #14745 untuk qwen3.5:9b; status perbaikan tidak bisa saya pastikan), audio, perbandingan model berdampingan, ekspor.

## 6. UI/UX dan liquid design

- **Area liquid \[Keputusan\]:** kolom input chat, tombol kirim, tombol-tombol aksi (ganti model, thinking, lampirkan gambar).
- **Asumsi \[perlu konfirmasi\]:** "liquid" = gaya Liquid Glass (kaca tembus pandang yang membiaskan latar). Jika maksudmu efek cair/gooey (blob menyatu), pendekatan teknisnya berbeda.
- **Dukungan teknis:** efek bias lewat `backdrop-filter: url(#filter)` dengan SVG `feDisplacementMap` hanya jalan di Chromium (kube.io, LogRocket). Tauri di Windows memakai WebView2 yang berbasis Chromium (v2.tauri.app/reference/webview-versions), jadi teknik ini cocok untuk targetmu.
- **Jebakan yang terdokumentasi:** dimensi filter harus pas dengan ukuran elemen (kube.io); elemen induk dengan `filter`, `opacity < 1`, atau animasi aktif membuat backdrop-filter di dalamnya menyaring ruang kosong (github.com/KrisSimon/Glassine).
- **Fallback:** mode hemat dengan `backdrop-filter: blur()` biasa, bisa dinyalakan otomatis saat model sedang menghasilkan teks jika FPS turun. **\[Verifikasi\]** dampak nyata ke GPU tidak bisa saya pastikan.
- **Proses desain:** referensi (Pinterest/Mobbins) lalu skill slicing, menghasilkan token (warna, tipografi, radius, blur, refraksi) dan komponen.

## 7. Tech stack (usulan)

| Lapisan | Pilihan | Alasan |
| --- | --- | --- |
| Shell | Tauri v2 \[Keputusan\] | Memakai WebView2 (Chromium) di Windows |
| Frontend | React + TypeScript + Vite | Vite direkomendasikan Tauri untuk SPA; template `react-ts` resmi; ada pustaka liquid glass untuk React (mis. glass-refraction) |
| Styling | Tailwind CSS + CSS variables | Token hasil slicing mudah dipetakan; LogRocket memakai pola serupa |
| Efek liquid | SVG displacement + backdrop-filter (utama); WebGL shader (opsional, hanya jika SVG kurang) | SVG lebih ringan untuk tahap awal; versi WebGL ada di contoh archisvaze/liquid-glass |
| Animasi | CSS transitions dulu; tambah pustaka hanya jika perlu | Hemat GPU/bundle |
| Komunikasi Ollama | REST `http://localhost:11434` (`/api/chat`, streaming), lewat perintah Rust atau `tauri-plugin-http` | Menghindari CORS di origin `tauri://localhost` (dev.to/purpledoubled). **\[Verifikasi\]** |
| Penyimpanan | JSON via `tauri-plugin-fs` untuk MVP; SQLite jika riwayat membesar | Sederhana dulu |
| State | Library state ringan (mis. Zustand) | Cukup untuk skala satu pengguna |

Prasyarat Windows: ikuti halaman prasyarat resmi Tauri v2 (v2.tauri.app/start/prerequisites). WebView2 sudah terpasang di Windows 11.

## 8. Persyaratan non-fungsional

- Hanya koneksi ke localhost, tanpa telemetri.
- CSP Tauri mengizinkan localhost:11434.
- Ollama v0.20.0+ untuk Gemma 4 (sumber sekunder: dev.to/apilover). Cek `ollama --version`.
- Hindari `OLLAMA_ORIGINS="*"` kecuali paham risikonya (objectgraph.com/blog/ollama-cors).

## 9. Kriteria keberhasilan

- Chat streaming berjalan di ketiga model pada laptop target.
- Pergantian model menampilkan status memuat dan tidak membuat aplikasi macet.
- Efek liquid di input dan tombol tampil benar di WebView2.
- Alias tampil konsisten.
- Toggle thinking dan upload gambar teruji per model.

## 10. Pertanyaan terbuka

1. Arti "liquid" yang kamu inginkan (Liquid Glass bias, atau gooey/blob)?
2. Nama dan karakter alias untuk tiap model.
3. Seberapa penting kecepatan dibanding kualitas untuk `gemma4:12b` bila ternyata sebagian berjalan di CPU?

## 11. Tahap berikutnya

Desain: kumpulkan referensi, jalankan slicing, susun layar (chat utama, pemilih model/alias, pengaturan model, riwayat).