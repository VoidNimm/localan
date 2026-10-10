---
name: design-local-chat
description: Panduan desain Web Chat AI Lokal & Privat. Baca file ini sebelum membuat atau mengubah UI apa pun untuk proyek ini; semua warna, tipografi, spasi, komponen, dan motion mengikuti dokumen ini.
version: 0.3.0
status: draft
mode: A
dibuat: 2026-10-06
---

# Design Guide: Local & Private AI Chat

## 0. Cara memakai dokumen ini

- Dokumen ini adalah **sumber kebenaran tunggal** untuk tampilan dan arsitektur antarmuka Local AI Chat. Bila kode dan dokumen berbeda, perbarui salah satunya, jangan biarkan berbeda.
- Gunakan selalu **token CSS** (`var(--...)`) untuk semua elemen, bukan nilai heksadesimal atau piksel mentah.
- Komponen efek liquid glass dibatasi secara ketat hanya pada komponen interaktif kecil (pill pemilih model, tombol +, kapsul input, tombol kirim) untuk menjaga performa rendering 60 FPS dan hemat daya baterai. Area scroll besar menggunakan background padat atau CSS backdrop blur biasa.
- Tanda keyakinan dalam panduan ini:
  - **T** (Tinggi): Diukur atau diverifikasi langsung dari berkas gambar, video, dan output teknis terkonfirmasi.
  - **S** (Sedang): Diestimasi dari kombinasi beberapa referensi visual atau sampling representatif dan disesuaikan ke skala konsisten.
  - **R** (Rendah): Nilai keputusan mandiri (seperti font sistem alternatif atau fallback browser) yang membutuhkan konfirmasi pengguna.
- Item bertanda `PERLU KONFIRMASI` terdaftar di Bagian 16 untuk diklarifikasi sebelum rilis final.

## 1. Ringkasan dan provenance

| Item | Isi |
|---|---|
| Produk / halaman | Web Chat AI Lokal & Privat (Single Page Application dengan dua fase: Landing dan Active Chat) |
| Audiens dan tugas utama | Pengguna komputer/laptop dan perangkat seluler yang ingin berinteraksi dengan Large Language Model secara lokal via Ollama tanpa login, tanpa telemetri, dan dengan privasi total. |
| Mode | A (Replikasi setia untuk identitas utama Mode A, dipadukan sintesis pola fungsional Mode B) |
| Sumber referensi | `reference/gambaran kasar.png` (Mode A: prototipe pemilik proyek, hak pakai penuh); `reference/reference1.jpg` (Mode B: pola sidebar & sapaan terpusat); `reference/reference2.jpg` (Mode B: hero minimalis tipografi ringan & tombol kirim bulat). |
| Cara sintesis | Mengambil identitas utama Mode A (sidebar gelap pekat, latar gurun pegunungan oranye, bar kontrol floating bawah dengan pill model dan tombol +). Memadukan pola Mode B: sapaan tipografi ramping di ruang kosong langit (reference2 & reference1), kartu status profil di bawah sidebar (reference1), dan tombol kirim melingkar dengan ikon panah (reference2). |
| Lebar acuan dan faktor skala | Desktop 1728 x 1117 px (skala 1:1 untuk layar Retina / Full HD), video master 1280 x 720 px rasio 16:9, viewport minimum yang didukung 320 px (keyakinan: T). |

## 2. Karakter dan prinsip

- **Kepribadian dalam 4 kata kunci:** *Warm-atmospheric*, *Confidential*, *Fluid*, *Uncluttered*.
- **Prinsip desain:**
  1. *Privacy is Tangible:* Memberi rasa aman visual melalui indikator lokal ("Ollama connected / 100% on-device") tanpa kebisingan visual atau formulir pendaftaran.
  2. *Atmospheric Immersion to Deep Focus:* Fase landing menghadirkan lanskap sinematik gurun oranye yang megah; saat pesan pertama dikirim, lanskap bertransisi mulus ke mode obrolan bernuansa gelap pekat (`#140a07`) yang minim distraksi baca (mengadopsi ritme claude.ai).
  3. *Immediate Response over Video Completion:* Respons model AI mulai dialirkan (streaming) segera setelah layout obrolan bergeser ke posisi siap, tanpa menahan pengguna menunggu hingga video transisi selesai diputar.
  4. *Dissolve over Hard Jumps:* Crossfade halus (`400ms`) menjembatani peralihan dari video1 ke video2 mengingat loop video1 dapat berada pada frame sembarang saat pengguna menekan tombol kirim.
  5. *Tactile Glass on Critical Touches:* Efek liquid glass diaplikasikan secara selektif dan presisi pada kontrol masukan sentuh dengan ukuran seragam 44px, bukan pada kontainer scroll.
- **Satu elemen yang sengaja dibuat paling menonjol:** Bar interaksi mengambang di bawah (Pill Model + Kapsul Input Sentuh + Tombol Aksi) yang memancarkan pendaran liquid glass di atas lanskap oranye.

## 3. Layout dan grid

- **Lebar maksimum konten chat:** `48rem` (768px) untuk kolom percakapan terpusat bergaya dokumen; lebar maksimum landing input: `44rem` (704px).
- **Margin samping layar:** Minimum `1rem` (16px) pada mobile, `2rem` (32px) pada tablet/desktop.
- **Sidebar lebar tetap:** `17.5rem` (280px) pada desktop; sliding off-canvas dengan backdrop overlay pada mobile.
- **Penjajaran default:** Rata kiri untuk teks hierarkis dan percakapan; rata tengah horizontal untuk hero greeting dan bar input landing.
- **Wireframe ASCII:**

```
+-------------------------------------------------------------------------------+
| SIDEBAR (280px, #1b1b1b)   | AREA UTAMA (Lanskap Video / Dark Background)     |
| [New Chat +]               |                                                  |
|                            |               [Sapaan Hero di Langit]            |
| Riwayat Chat:              |      "What would you like to explore today?"     |
| - Diskusi Kode Python      |                                                  |
| - Analisis Data Lokal      |                                                  |
| - Rangkuman Dokumen        |                                                  |
|                            |                                                  |
|                            |                                                  |
|                            |                [Pill Model v]                    |
|                            |        [+] [ Ask anything...               ] [^] |
| [Kartu Status Ollama]      |          Everything is local and private.        |
+-------------------------------------------------------------------------------+
```

```
+-------------------------------------------------------------------------------+
| SIDEBAR (#1b1b1b)          | MODE ACTIVE CHAT (Background Statis #140a07)     |
| [New Chat +]               |                                                  |
|                            |   User: Jelaskan arsitektur neural network...    |
| Riwayat Chat aktif...      |                                                  |
|                            |   AI Assistant (Gemma4:e2b):                     |
|                            |   Arsitektur neural network tersusun atas:       |
|                            |   ```python                                      |
|                            |   import torch.nn as nn                          |
|                            |   ```                                            |
|                            |   [Salin Kode]                                   |
|                            |                                                  |
|                            |        [+] [ Ketik pesan lanjutan...       ] [^] |
+-------------------------------------------------------------------------------+
```

## 4. Pola halaman (section)

| Section | Tujuan | Struktur | Komponen dipakai | Perilaku mobile |
|---|---|---|---|---|
| 0.1.3 | 2026-10-06 | Integrasi GlassLens, penyesuaian UI Chat, perbaikan token warna & hero contrast | Peningkatan konsistensi visual, performa hover, dan pelokalan bahasa label |
| Sidebar | Navigasi obrolan baru, riwayat sesi lokal, dan status Ollama | Vertikal flex stack, fixed lebar 280px | Tombol New Chat, Daftar Sesi Riwayat, Indikator Ollama ringkas | Tersembunyi default, dapat dibuka via tombol burger bar kiri atas |
| Sky Hero (Landing) | Memberi sapaan ramah dan menata ruang bernapas di atas lanskap | Stack terpusat di area sepertiga atas | Heading h1 tipografi tipis (tanpa subtitle; pesan privasi hanya lewat tagline dan status Ollama di sidebar) | Ukuran font scaling dinamis (fluid text) agar tidak terpotong |
| Input Bar Island | Kontrol pemilih model AI dan input pesan pengguna | Vertikal stack (Model Pill di atas, row input di bawah, tagline di kaki) | Pill Model Dropdown, Tombol Lampiran (+), Textarea Auto-expand, Tombol Kirim / Stop Bundar | Lebar menyesuaikan layar ponsel dengan margin padding 16px |
| Folder Kerja (Active Chat) | Menghubungkan direktori lokal untuk dibaca dan ditulis oleh AI | Kartu terhubung di Project, pill indikator, dialog pemilihan folder, dan panel Diff/Persetujuan untuk tindakan modifikasi file | Diaktifkan via Project View atau Chat |
| Conversation Feed (Chat) | Menampilkan percakapan bersih ala claude.ai tanpa bubble berat | Kolom terpusat scroll vertikal `max-w-3xl` | User Message Item, AI Response (Markdown + Code highlight + Copy Button), Streaming Indicator, Error/Offline Banner | Padding samping mengecil ke 16px, auto-scroll ke bawah saat stream |

## 5. Design tokens

### 5.1 Warna

| Token | Nilai | Peran | Keyakinan |
|---|---|---|---|
| 0.1.3 | 2026-10-06 | Integrasi GlassLens, penyesuaian UI Chat, perbaikan token warna & hero contrast | Peningkatan konsistensi visual, performa hover, dan pelokalan bahasa label |
| `--color-surface` | `#1f1614` | Latar permukaan kartu (seperti bubble chat dan modal) | S |
| `--color-accent` | `#ea580c` | Aksen warna cerah untuk ikon, tautan, atau interaksi | S |
| `--color-bg` | `#140a07` | Latar belakang obrolan aktif dan kanvas utama (sampled dari frame akhir video2) `PERLU KONFIRMASI` | S |
| `--color-sidebar-bg` | `#1b1b1b` | Latar belakang bilah navigasi kiri sesuai prototipe | T |
| `--color-sidebar-surface` | `#242426` | Permukaan kartu item atau hover pada sidebar | S |
| `--color-text` | `#f5f5f7` | Teks judul dan isi utama dengan kontras tinggi | T |
| `--color-text-muted` | `#a1a1aa` | Teks keterangan sekunder, riwayat chat, dan metadata | S |
| `--color-primary` | `#c2410c` | Aksen warna hangat terakota / gurun matahari senja | S |
| `--color-on-primary` | `#ffffff` | Teks di atas warna primer | T |
| `--color-border` | `#332520` | Garis pemisah halus bernuansa tembaga gelap | S |
| `--color-glass-fallback` | `#1f1614` | Warna dasar fallback komponen kaca bila shader dimatikan | S |
| `--color-scrim-top` | `#2b140d` | Latar gradasi scrim atas untuk keterbacaan sapaan di langit video | S |
| `--color-scrim-bottom` | `#1e110c` | Latar gradasi scrim bawah untuk keterbacaan bar input dan tagline di atas video | S |

**Pasangan kontras yang dipakai** (diperiksa otomatis oleh lint):

| Teks | Latar | Ukuran teks | Minimum |
|---|---|---|---|
| 0.1.3 | 2026-10-06 | Integrasi GlassLens, penyesuaian UI Chat, perbaikan token warna & hero contrast | Peningkatan konsistensi visual, performa hover, dan pelokalan bahasa label |
| `--color-text` | `--color-bg` | normal | 4.5 |
| `--color-text` | `--color-sidebar-bg` | normal | 4.5 |
| `--color-text` | `--color-surface` | normal | 4.5 |
| `--color-text-muted` | `--color-bg` | normal | 4.5 |
| `--color-text-muted` | `--color-sidebar-bg` | normal | 4.5 |
| `--color-on-primary` | `--color-primary` | normal | 4.5 |
| `--color-text` | `--color-scrim-top` | normal | 4.5 |
| `--color-text` | `--color-scrim-bottom` | normal | 4.5 |
| `--color-text-muted` | `--color-scrim-bottom` | normal | 4.5 |

Token scrim gradasi (di `index.css`, dipakai oleh `VideoBackground`): `--scrim-top`, `--scrim-bottom`, `--scrim-top-h` (30rem), `--scrim-bottom-h` (22rem). Permukaan kaca (`.glass-surface`) memakai alas gelap `rgb(20 10 7 / 0.5)` agar teks pill tetap terbaca.

Catatan kontras area video:
- Teks sapaan hero (`--color-text`) di atas scrim langit (`--color-scrim-top`) mencapai rasio **15.96:1** (jauh melampaui standar WCAG AA 4.5:1).
- Teks tagline bawah (`--color-text-muted`) di atas scrim bawah (`--color-scrim-bottom`) mencapai rasio **7.18:1** (memenuhi batas teks normal 4.5:1).

### 5.2 Tipografi

| Token | Nilai | Dipakai untuk | Keyakinan |
|---|---|---|---|
| 0.1.3 | 2026-10-06 | Integrasi GlassLens, penyesuaian UI Chat, perbaikan token warna & hero contrast | Peningkatan konsistensi visual, performa hover, dan pelokalan bahasa label |
| `--font-sans` | `"Manrope Variable", "Manrope", sans-serif` (self-host via paket `@fontsource-variable/manrope`, tanpa CDN) | Seluruh teks antarmuka dan isi obrolan | S |
| `--font-mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Blok kode program markdown dan nama model teknis | T |
| `--text-xs` | `0.75rem` | Tagline privasi dan label status kecil | S |
| `--text-sm` | `0.875rem` | Item riwayat percakapan dan opsi dropdown model | S |
| `--text-md` | `1rem` | Teks input percakapan dan balasan AI standar | T |
| `--text-lg` | `1.125rem` | Judul modal atau sub-sapaan | S |
| `--text-2xl` | `1.75rem` | Judul sapaan hero mobile | S |
| `--text-4xl` | `2.5rem` | Judul sapaan hero desktop bergaya reference2 | S |

Aturan tipografi: Paragraf obrolan dibatasi lebar maksimum 75 karakter per baris untuk kenyamanan mata. Heading sapaan menggunakan font-weight 300 (light) dengan tracking rapat tipis `-0.02em`.

### 5.3 Spasi

| Token | Nilai |
|---|---|
| `--space-1` | `0.25rem` |
| `--space-2` | `0.5rem` |
| `--space-3` | `0.75rem` |
| `--space-4` | `1rem` |
| `--space-6` | `1.5rem` |
| `--space-8` | `2rem` |
| `--space-12` | `3rem` |

### 5.4 Bentuk: radius, border, bayangan

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--radius-sm` | `8px` | Kartu status kecil dan tooltip |
| `--radius-md` | `14px` | Menu dropdown model dan kartu dialog |
| `--radius-pill` | `9999px` | Kapsul input bar, pill model picker, dan tombol aksi melingkar |
| `--shadow-sm` | `0 2px 8px rgba(0, 0, 0, 0.25)` | Dropdown dan tombol mengambang |
| `--shadow-glass` | `0 8px 32px rgba(0, 0, 0, 0.35)` | Elevasi bar input di atas lanskap video |

### 5.5 Motion

| Token | Nilai | Dipakai untuk |
|---|---|---|
| `--dur-fast` | `150ms` | Efek hover tombol dan interaksi klik |
| `--dur-base` | `300ms` | Pembukaan dropdown dan transisi memudar sapaan langit |
| `--dur-video-crossfade` | `400ms` | Crossfade lembut dari video1 ke video2 saat prompt dikirim |
| `--dur-layout-shift` | `600ms` | Pergeseran posisi bar input ke mode chat terpusat |
| `--dur-static-crossfade` | `600ms` | Crossfade video2 mendekati akhir menuju background statis |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Kurva perlambatan alami untuk transisi masuk dan pergeseran layout |

### 5.6 Lapisan (z-index) dan ukuran kontrol

| Token | Nilai |
|---|---|
| `--control-h` | `44px` |
| `--z-video-base` | `1` |
| `--z-video-active` | `2` |
| `--z-overlay` | `10` |
| `--z-ui-content` | `20` |
| `--z-dropdown` | `50` |
| `--z-sidebar-mobile` | `60` |

Catatan keselarasan ukuran kontrol: Seluruh kontrol baris bawah (Pill Model, Tombol +, Kapsul Input, dan Tombol Kirim/Stop) diselaraskan pada tinggi/diameter minimal yang sama yaitu `var(--control-h)` (`44px`). Ukuran ini melampaui standar minimum WCAG SC 2.5.8 (Level AA, 24x24 px) dan memenuhi standar ketat WCAG SC 2.5.5 (Level AAA, 44x44 px) secara konsisten.

### 5.7 Titik patah

| Nama | Min lebar | Perubahan utama |
|---|---|---|
| sm | 640px | Penataan padding horizontal bar input |
| md | 768px | Sidebar bertransformasi dari overlay hamburger menjadi panel samping permanen 280px |
| lg | 1024px | Judul sapaan langit membesar ke ukuran hero desktop 40px |

## 6. Ikon dan gambar

- **Set Ikon:** Lucide React (lisensi ISC), stroke width 1.75px, gaya minimalis elegan.
  - Ikon panah kirim: `ArrowUp` dalam lingkaran bulat.
  - Ikon henti kirim: `Square` dalam lingkaran bulat (Stop button).
  - Ikon lampiran: `Plus` dalam lingkaran lembut.
  - Ikon model: Ikon logo resmi aplikasi (`/assets/logo.png`) dan `ChevronDown`.
  - Ikon obrolan: `MessageSquarePlus` untuk New Chat, `Clock` untuk riwayat, `Server` untuk status Ollama, `Trash2` untuk hapus, `Copy` dan `Check` untuk blok kode.
- **Aset Logo & Brand:**
  - `logo.png`: Logo aplikasi (100x100 px squircle gelap dengan lambang geometris), diterapkan pada header sidebar, ikon model AI (pill & list), header respons asisten di chat feed, serta animasi visual saat AI sedang berpikir/loading.
- **Aset Video & Background:**
  - `background.jpg`: Poster foto resolusi 1376x768 yang dimuat seketika sebagai fondasi non-kedip.
  - `video1.mp4`: Video loop pemandangan gurun pegunungan (1280x720, 8 detik, muted, playsInline).
  - `video2.mp4`: Video transisi sinematik timelapse matahari terbenam (1280x720, 8 detik) yang berujung pada warna gelap senja.
  - `background-akhir.png`: Gambar statis warna tunggal `#140a07` (1920x1080) sebagai kanvas abadi chat aktif.

## 7. Komponen

### ModelSelectorPill
- **Tujuan:** Menampilkan model AI aktif dan membuka daftar pilihan model lokal yang terpasang di Ollama.
- **Anatomi:** Ikon model AI (`logo.png`), label nama model, badge kemampuan ringkas ("Fast for answering"), dan ikon chevron.
- **Varian:** Default mengambang (liquid glass pill).
- **Ukuran:** Tinggi tetap 44px (`var(--control-h)`), radius 9999px.
- **State:** Default, hover (sedikit memendarkan pendar kaca), open (dropdown muncul ke atas/bawah), loading (indikator pulsing saat model memuat bobot ke memori).
- **Token dipakai:** `var(--control-h)`, `var(--color-text)`, `var(--radius-pill)`, `var(--dur-fast)`, `var(--ease-out)`
- **Aturan:** Selalu diletakkan di atas kapsul input pada fase landing maupun fase chat.
- **Aksesibilitas:** Elemen `<button aria-haspopup="listbox" aria-expanded="...">` dengan kontrol navigasi panah keyboard.
- **Contoh markup:**
```html
<button class="pill-model" aria-haspopup="listbox" aria-expanded="false">
  <span class="pill-model__title">gemma4:e2b</span>
  <span class="pill-model__desc">Fast for answering</span>
</button>
```

### EffortPill
- **Tujuan:** Mengontrol tingkat penalaran atau proses berpikir (thinking) dari model AI yang dipilih.
- **Anatomi:** Ikon yang merepresentasikan "pikiran" (misal: Lightbulb atau Brain), teks indikator status ("Mati", "Hidup", "Rendah", "Sedang", "Tinggi"), dan ikon chevron.
- **Varian:** Default mengambang (liquid glass pill). Hanya tampil jika model memiliki kemampuan berpikir (`capabilities: ["thinking"]`).
- **Ukuran:** Tinggi tetap 44px (`var(--control-h)`), radius 9999px.
- **State:** Default, hover, open (dropdown menu). Pilihan state disimpan di `localStorage` per-model. Opsi default awal adalah Mati (off) dengan pengecualian model >=10B secara default disetel Mati untuk efisiensi jika belum ada riwayat preferensi pengguna. Pada model GPT-OSS, opsinya adalah Rendah/Sedang/Tinggi (tanpa opsi Mati).
- **Token dipakai:** `var(--control-h)`, `var(--color-text)`, `var(--radius-pill)`, `var(--dur-fast)`, `var(--ease-out)`
- **Aturan:** Diletakkan bersebelahan di sebelah kiri atau kanan Pill Model. Jika model tidak mendukung thinking atau fallback tidak diketahui, pill ini disembunyikan.
- **Contoh markup:**
```html
<button class="pill-effort" aria-haspopup="listbox">
  <svg class="icon-brain"></svg>
  <span>Berpikir: Hidup</span>
</button>
```

### ActionPlusButton
- **Tujuan:** Menyediakan pemicu penambahan lampiran dokumen/file atau prompt cepat.
- **Anatomi:** Tombol bulat dengan ikon Plus di tengah.
- **Varian:** Liquid glass circular button.
- **Ukuran:** Diameter 44px (`var(--control-h)`), radius 9999px.
- **State:** Default, hover, active (ditekan), disabled.
- **Token dipakai:** `var(--control-h)`, `var(--radius-pill)`, `var(--dur-fast)`
- **Aturan:** Berada persis di sebelah kiri kapsul input teks.
- **Aksesibilitas:** `<button type="button" aria-label="Tambah lampiran atau opsi prompt">`.
- **Contoh markup:**
```html
<button type="button" class="btn-circle-glass" aria-label="Tambah lampiran">
  <svg class="icon-plus"></svg>
</button>
```

### ChatInputCapsule
- **Tujuan:** Bidang input utama bagi pengguna untuk mengetik pertanyaan atau instruksi.
- **Anatomi:** Kapsul memanjang dengan textarea terpadu yang membesar otomatis mengikuti jumlah baris.
- **Varian:** Single-line to multi-line auto-expand (dari 44px hingga batas wajar 160px).
- **Ukuran:** Min tinggi 44px (`var(--control-h)`), padding horizontal 20px.
- **State:** Default, focus-visible (cincin fokus halus tanpa merusak lengkungan kaca), populated (terisi teks).
- **Token dipakai:** `var(--control-h)`, `var(--color-text)`, `var(--font-sans)`, `var(--text-md)`, `var(--radius-pill)`
- **Aturan:** Tekan `Enter` untuk mengirim pesan, `Shift+Enter` untuk menyisipkan baris baru.
- **Aksesibilitas:** `<textarea aria-label="Ketik instruksi percakapan" rows="1">` dengan autofocus saat landing siap.
- **Contoh markup:**
```html
<div class="input-capsule-glass">
  <textarea placeholder="Ask anything..." aria-label="Pesan obrolan"></textarea>
</div>
```

### SendButtonRound
- **Tujuan:** Memicu pengiriman pesan pengguna ke model AI lokal atau menghentikan generasi (Stop).
- **Anatomi:** Tombol bundar berisi ikon panah mengarah ke atas (`ArrowUp`) saat idle, atau ikon kotak henti (`Square`) saat model sedang streaming jawaban.
- **Varian:** Bulat melingkar (mengadopsi reference2).
- **Ukuran:** Diameter 44px (`var(--control-h)`).
- **State:** Disabled (saat input teks kosong, opasitas 40%), active/enabled (input berisi karakter, latar kontras tegas), generating/stop (warna oranye menyala dengan ikon stop kotak).
- **Token dipakai:** `var(--control-h)`, `var(--color-primary)`, `var(--color-on-primary)`, `var(--dur-fast)`
- **Aturan:** Berada di sisi kanan input capsule. Saat generasi aktif, klik tombol ini akan membatalkan streaming secara instan.
- **Aksesibilitas:** `<button type="button" aria-label="Kirim pesan" disabled>`.
- **Contoh markup:**
```html
<button type="button" class="btn-send-round" aria-label="Kirim pesan" disabled>
  <svg class="icon-arrow-up"></svg>
</button>
```

### UserMessageItem
- **Tujuan:** Menampilkan pesan instruksi atau pertanyaan yang dikirim pengguna.
- **Anatomi:** Header label pengirim ("You"), gelembung teks rapi rata kanan dengan latar gelap padat.
- **Varian:** Aligned right, rounded bubble.
- **Ukuran:** Lebar maksimum 75% dari kolom chat.
- **State:** Rendered.
- **Token dipakai:** `var(--color-text)`, `var(--font-sans)`, `var(--text-md)`, `var(--radius-md)`
- **Aturan:** Menjaga teks ringkas tanpa bubble raksasa yang boros ruang.
- **Contoh markup:**
```html
<div class="chat-message chat-message--user">
  <p>Jelaskan cara kerja memori inferensi Ollama secara lokal.</p>
</div>
```

### AiResponseItem
- **Tujuan:** Menampilkan jawaban asistensi AI dalam tata letak dokumen bersih ala claude.ai.
- **Anatomi:** Header ikon model AI (`logo.png`) dan nama model aktif, blok "Proses berpikir" (ReasoningBlock) jika ada, isi format Markdown lengkap (paragraf, daftar, tabel), blok kode dengan bilah salin kode, serta kursor berkedip saat streaming.
- **Varian:** Unbubbled, rata kiri penuh selebar kolom `max-w-3xl`.
- **Ukuran:** Lebar 100% dari kolom chat `max-w-3xl`.
- **State:** Streaming (dengan pulsing cursor), finished, error/offline.
- **Token dipakai:** `var(--color-text)`, `var(--color-border)`, `var(--font-mono)`, `var(--dur-fast)`
- **Aturan:** Tidak menggunakan bubble berlatar tebal di sekeliling jawaban agar nyaman dibaca seperti dokumen panjang. Blok "Proses berpikir" otomatis terbuka (expanded) saat model sedang memikirkan respons (menerima token thinking), dan otomatis melipat (collapsed) begitu token jawaban pertama datang. Teks di dalam blok ini ditampilkan dalam font kecil (ukuran sm) apa adanya dan tinggi blok dibatasi dengan scroll. Blok ini juga menampilkan durasi proses berpikir secara keseluruhan.
- **Contoh markup:**
```html
<div class="chat-message chat-message--assistant">
  <div class="assistant-content">
    <details class="reasoning-block">
      <summary>Proses berpikir (2.5s)</summary>
      <div class="reasoning-content">Menganalisis permintaan...</div>
    </details>
    <p>Ollama menjalankan inferensi langsung di mesin lokal Anda...</p>
    <div class="code-block">
      <div class="code-block__header">
        <span>python</span>
        <button class="btn-copy">Salin</button>
      </div>
      <pre><code>import ollama</code></pre>
    </div>
  </div>
</div>
```

### SidebarNavigation
- **Tujuan:** Menampilkan navigasi chat baru, riwayat percakapan lokal, dan status server Ollama dengan nuansa bersih tanpa "AI slop".
- **Anatomi:** Header identitas brand dengan logo aplikasi (`/assets/logo.png`) dan nama produk, tombol chat baru, daftar riwayat sesi dengan tombol hapus/ganti nama, dan satu indikator status Ollama (titik hijau) di bagian bawah.
- **Varian:** Desktop fixed panel (lebar 280px) dan mobile drawer overlay.
- **Ukuran:** Lebar 280px.
- **State:** Default, item hover, item selected.
- **Token dipakai:** `var(--color-sidebar-bg)`, `var(--color-sidebar-surface)`, `var(--color-text-muted)`
- **Aturan:** 
  - Tidak memakai profil pengguna palsu ("Local User") atau slogan generik.
  - Hapus pengulangan tombol (toggle sidebar disatukan, tombol New Chat cukup satu yang fungsional).
  - Hindari penggunaan emoji berwarna (ganti dengan ikon Lucide netral atau hapus).
  - Warna oranye (aksen) diminimalkan hanya untuk status aktif atau CTA utama.
  - Tidak memakai efek liquid glass karena area scroll luas; menggunakan latar padat `#1b1b1b` untuk efisiensi render.
- **Aksesibilitas:** Landmark `<aside aria-label="Riwayat Obrolan">` dengan tombol berlabel jelas.
- **Contoh markup:**
```html
<aside class="sidebar-panel" aria-label="Riwayat Obrolan">
  <button class="btn-new-chat">+ New Chat</button>
  <nav class="history-list"></nav>
  <div class="user-card"></div>
</aside>
```

### GlassLens
- **Tujuan:** Memberikan efek sorotan kaca (liquid glass) interaktif yang bergeser dinamis mengikuti item yang di-hover atau aktif di dalam daftar.
- **Aturan:** Hanya boleh diinstansiasi satu buah per daftar (misal satu di Sidebar, satu di Dropdown Model) untuk menjaga 60 FPS. Bergerak dengan transisi halus (`200ms cubic-bezier(0.16, 1, 0.3, 1)`). Pelacakan hover harus responsif melintasi seluruh item tanpa tersangkut pada item aktif (dengan toleransi jeda batas antar-item dan penanganan tombol aksi).

### Projects & CreateProjectDialog
- **Tujuan:** Manajemen konteks percakapan secara terisolasi.
- **Anatomi:** Kartu halaman project workspace dan modal overlay Buat Project.
- **Aturan:** 
  - Menggunakan gaya liquid glass CSS buatan sendiri (`.glass-panel`) untuk panel buram dengan alas gelap tipis agar rasio kontras teks tetap >= 4.5:1.
  - Elemen area input atau list berupa sumur gelap translusen (`.glass-well`).
  - Tombol sekunder menggunakan `.glass-pill`.
  - Hindari penggunaan shader `liquid-glass-react` untuk komponen panel besar guna menjaga performa; gunakan CSS `backdrop-filter` atau fallback padat.
  - Saat modal terbuka penuh layar di atas animasi, latar video wajib di-pause, dan hindari `backdrop-filter: blur` berlebih jika menyebabkan GPU compositing lag.

### ThinkingIndicator
- **Tujuan:** Menampilkan status proses kognitif model secara jujur (misal "Sedang menjawab..." jika tidak ada thinking yang aktif). Untuk indikator thinking yang menggunakan jejak (trace), lihat ReasoningBlock di `AiResponseItem`.
- **Anatomi:** Logo AI (`/assets/logo.png`) dengan pendaran/animasi pulse hangat (`animate-pulse`) saat proses berpikir/loading, teks status tahapan proses dengan titik-titik (elipsis) yang beranimasi halus.
- **Varian:** Inline fallback indicator.
- **Token dipakai:** `var(--color-text-muted)`, `var(--text-sm)`

### DeleteChatDialog
- **Tujuan:** Menampilkan modal alert peringatan konfirmasi sebelum menghapus sesi chat secara permanen dari penyimpanan lokal browser (`localStorage`).
- **Anatomi:** Ikon peringatan bahaya (`Trash2`), judul konfirmasi, ringkasan judul sesi percakapan dalam kotak `.glass-well`, teks peringatan bahwa riwayat terhapus sepenuhnya dan tidak dapat dikembalikan, tombol Batal netral, dan tombol Hapus Permanen bernuansa destruktif.
- **Varian:** Modal dialog overlay berlatar `.glass-panel`.
- **Ukuran:** Lebar maksimum `sm:max-w-md` dengan sudut rounded `var(--radius-md)` dan border halus `var(--color-border)`.
- **State:** Open / Closed (saat terbuka, latar video di-pause untuk efisiensi dan performa).
- **Token dipakai:** `var(--color-surface)`, `var(--color-text)`, `var(--color-text-muted)`, `var(--color-border)`, `var(--radius-md)`, `var(--radius-pill)`, `var(--dur-fast)`
- **Aturan:** Mencegah kehilangan data percakapan lokal yang tidak dapat dipulihkan akibat penekanan tombol tidak sengaja.

## 8. State dan alur interaksi

1. **Inisialisasi Halaman (Landing Ready):**
   - Poster `background.jpg` tampil seketika.
   - `video1` mulai di-stream di latar belakang; begitu event `canplay` terpicu, `video1` melakukan transisi fade-in lembut (`var(--dur-base)`) menutupi poster.
   - `video2` dimuat dengan `preload="auto"` dalam keadaan tidak terlihat (`opacity: 0`).
   - Elemen UI (sapaan langit, bar input bawah, sidebar) bertransisi masuk bertahap (stagger fade/slide).
   - Penghematan daya: Jika tab tidak aktif (`document.hidden`), `video1` otomatis di-pause.

2. **Pengiriman Pesan Pertama (Transisi Sinematik ~2-3 detik):**
   - **Mulai Segera:** Pesan langsung ditangkap ke riwayat obrolan dan request streaming ke Ollama langsung dijalankan tanpa menunggu transisi video berakhir.
   - **Dissolve Video1 ke Video2:** Karena `video1` berada dalam loop aktif (bisa di detik ke-1, 3, atau 6), crossfade sebesar `var(--dur-video-crossfade)` (`400ms`) melarutkan `video1` secara mulus ke frame awal `video2` tanpa lompatan visual kasar.
   - **Pemutaran Dipercepat:** `video2` diputar satu kali dengan kecepatan dipercepat (`playbackRate = 4.0`), sehingga timelapse 8 detik rampung dalam ~2 detik.
   - **Pergeseran Layout:** Bersamaan dengan itu, sapaan langit memudar keluar (`var(--dur-base)` = `300ms`), dan bar input bergeser ke posisi docked chat (`var(--dur-layout-shift)` = `600ms`).
   - **Streaming Mengalir Dini:** Begitu layout obrolan bergeser (detik ke-0.4), jawaban AI langsung mulai dialirkan (streaming) ke feed percakapan di atas latar video yang sedang meredup menuju senja. Pengguna tidak dipaksa menunggu pemutaran video selesai.
   - **Peralihan ke Background Statis:** Pada video-time 6.0s (~1.5 detik nyata pada 4x, saat video2 mencapai frame gelap senja), kontainer video melakukan crossfade ke background statis `#140a07` (`var(--dur-static-crossfade)` = `600ms`).
   - **Pembersihan DOM:** Tepat setelah crossfade selesai (~2.1 detik teoretis), kedua elemen `<video>` dilepas/di-unmount sepenuhnya dari DOM untuk menghemat memori GPU/RAM.

3. **Tombol Stop dan Pembatalan Generasi:**
   - Saat AI sedang mengalirkan jawaban, tombol kirim bertransformasi menjadi tombol Stop bundar.
   - Mengklik tombol Stop akan memicu sinyal `abort()` pada `AbortController`, menghentikan aliran kata seketika, dan mempertahankan teks parsial yang sudah diterima.

4. **Penyimpanan Riwayat Lokal (Stateless by Design):**
   - Seluruh percakapan disimpan secara privat di `localStorage` peramban pengguna dalam format JSON:
     - `id`: identifier unik sesi (`session_<timestamp>`)
     - `title`: ringkasan 36 karakter pesan pertama atau judul yang diganti pengguna
     - `timestamp`: waktu pembuatan sesi
     - `model`: nama model Ollama yang dipakai
     - `messages`: daftar objek `{ id, role, content, timestamp }`
   - Aksi pada item riwayat di sidebar dan bar kontrol obrolan aktif:
     - **Klik item:** Membuka dan merender riwayat percakapan tersebut.
     - **Klik tombol hapus:** Membuka modal alert konfirmasi (`DeleteChatDialog`) yang menegaskan bahwa percakapan akan terhapus sepenuhnya dan tidak dapat dikembalikan. Setelah pengguna mengonfirmasi dengan memilih Hapus Permanen, sesi dihapus dari `localStorage` dan mereset tampilan jika sesi aktif yang dihapus.

5. **Penanganan Kasus Offline & Error Ollama:**
   - Bila koneksi ke port 11434 terputus atau model belum terpasang, sistem menampilkan banner informatif berwarna tembaga/amber dengan instruksi ramah: *"Ollama belum terdeteksi aktif di port 11434. Pastikan aplikasi Ollama berjalan di komputer Anda."*
   - Tersedia tombol *"Coba Hubungkan Ulang"* untuk memicu polling ulang tanpa memuat ulang seluruh halaman web.

6. **Tombol "New Chat":**
   - Mengembalikan layout ke mode landing.
   - Latar belakang bertransisi dari `#140a07` kembali ke poster `background.jpg`, elemen video1 dimuat kembali dan berputar secara looping.

## 9. Motion

| # | Elemen | Pemicu | Properti | Durasi | Easing | Keyakinan |
|---|---|---|---|---|---|---|
| 0.1.3 | 2026-10-06 | Integrasi GlassLens, penyesuaian UI Chat, perbaikan token warna & hero contrast | Peningkatan konsistensi visual, performa hover, dan pelokalan bahasa label |
| 1 | Video 1 Masuk | Event `canplay` | opacity | 300ms | ease-out | T |
| 2 | Sky Hero Reveal | Landing siap | opacity, translateY | 600ms | cubic-bezier(0.16, 1, 0.3, 1) | S |
| 3 | Input Bar Reveal | Landing siap | opacity, translateY | 600ms | cubic-bezier(0.16, 1, 0.3, 1) | S |
| 4 | Sky Hero Exit | Submit pesan pertama | opacity, translateY | 300ms | ease-in | S |
| 5 | Video 1 ke Video 2 | Submit pesan pertama | opacity | 400ms | ease-out | T |
| 6 | Transisi Input ke Dock | Submit pesan pertama | width | 600ms | cubic-bezier(0.16, 1, 0.3, 1) | S |
| 7 | AI Stream Reveal | Layout bergeser (detik 0.4) | opacity | 200ms | ease-out | S |
| 8 | Video ke Background Statis | Video-time 6.0s (~1.5 detik nyata) | opacity video | 600ms | ease-out | T |
| 9 | Unmount Video Elements | Detik ke-2.6 transisi | DOM presence | 0ms | instant | T |

Aturan motion: Jika pengguna menyetel `prefers-reduced-motion: reduce`, semua elemen video tidak diputar sama sekali; antarmuka langsung menyajikan `background.jpg` pada landing dan beralih ke warna statis `#140a07` tanpa animasi gerak.

## 10. Konten dan suara

- **Nada Bahasa:** Lugas, elegan, tenang, dan transparan. Tidak bertele-tele dan tidak memakai jargon palsu.
- **Tagline Privasi:** *"Everything is local and private."* Muncul tepat satu kali di bawah bar input saat mode landing untuk menegaskan keunggulan privasi tanpa kesan repetitif.
- **Pesan Status Model:**
  - `gemma4:e2b`: *"Fast for answering"*
  - `gemma4:12b`: *"Deep reasoning & analysis"*
  - `qwen3.5:9b`: *"Multilingual & code precision"*
- **Pesan Offline Ollama:** *"Ollama belum terdeteksi aktif di port 11434. Pastikan aplikasi Ollama berjalan di komputer Anda."* Lengkap dengan opsi tombol *Coba Hubungkan Ulang*.

## 11. Aksesibilitas

- **Kontras Warna:** Seluruh pasangan teks utama (`--color-text`) dan sekunder (`--color-text-muted`) terhadap latar belakang (`--color-bg`, `--color-sidebar-bg`, `--color-scrim-top`, dan `--color-scrim-bottom`) memiliki rasio kontras di atas 4.5:1 (memenuhi WCAG AA 1.4.3).
- **Target Sentuh Interaktif:** Seluruh kontrol interaktif (pill model, tombol +, tombol kirim/stop, tombol New Chat) memiliki target sentuh dan tinggi seragam minimal 44 x 44 piksel CSS (`var(--control-h)` = 44px, melampaui WCAG SC 2.5.8 Level AA 24px dan memenuhi WCAG SC 2.5.5 Level AAA 44px).
- **Fokus Keyboard:** Indikator fokus `:focus-visible` memiliki cincin kontras tinggi dengan `outline-offset` yang jelas bagi navigasi tab keyboard.
- **Fallback Liquid Glass (Safari, Firefox, dan Reduced Motion):** Peramban Apple Safari dan Mozilla Firefox memiliki keterbatasan atau ketiadaan dukungan terhadap WebGL displacement shader dalam paket `liquid-glass-react`. Pada peramban tersebut serta pada mode `prefers-reduced-motion: reduce`, sistem mengaktifkan fallback CSS murni dengan `backdrop-filter: blur(14px)` dan border semi-transparan `rgba(255, 255, 255, 0.15)` berlatar `var(--color-glass-fallback)`.

## 12. Implementasi

### 12.1 `tokens.css` (salinan dari bagian 5)

```css
:root {
  --color-bg: #140a07;
  --color-sidebar-bg: #1c110d;
  --color-sidebar-surface: #271813;
  --color-text: #f5f5f7;
  --color-text-muted: #a1a1aa;
  --color-primary: #c2410c;
  --color-on-primary: #ffffff;
  --color-border: #332520;
  --color-surface: #1f1614;
  --color-accent: #ea580c;
  --color-glass-fallback: #1f1614;
  --color-scrim-top: #2b140d;
  --color-scrim-bottom: #1e110c;

  --font-sans: "Manrope Variable", "Manrope", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-md: 1rem;
  --text-lg: 1.125rem;
  --text-2xl: 1.75rem;
  --text-4xl: 2.5rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-pill: 9999px;

  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.25);
  --shadow-glass: 0 8px 32px rgba(0, 0, 0, 0.35);

  --dur-fast: 150ms;
  --dur-base: 300ms;
  --dur-video-crossfade: 400ms;
  --dur-layout-shift: 600ms;
  --dur-static-crossfade: 600ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);

  --scrim-top: linear-gradient(to bottom, rgb(43 20 13 / 0.72) 0%, rgb(43 20 13 / 0.55) 55%, transparent 100%);
  --scrim-bottom: linear-gradient(to top, rgb(20 10 7 / 0.9) 0%, rgb(20 10 7 / 0.8) 50%, rgb(20 10 7 / 0.4) 82%, transparent 100%);
  --scrim-top-h: 30rem;
  --scrim-bottom-h: 22rem;

  --control-h: 44px;
  --z-video-base: 1;
  --z-video-active: 2;
  --z-overlay: 10;
  --z-ui-content: 20;
  --z-dropdown: 50;
  --z-sidebar-mobile: 60;
}
```

### 12.2 Pemetaan ke framework

Aplikasi dibangun menggunakan React 19 + Vite + Tailwind CSS v4. Konfigurasi `@tailwindcss/vite` membaca variabel CSS di `:root` secara otomatis, didukung oleh komponen `liquid-glass-react` untuk efek pembiasan cahaya cairan.

### 12.3 Struktur berkas

```
local-chat/
├── public/
│   └── assets/
│       ├── background.jpg
│       ├── background-akhir.png
│       ├── video1.mp4
│       └── video2.mp4
├── src/
│   ├── components/
│   │   ├── ChatFeed.tsx
│   │   ├── GlassSurface.tsx
│   │   ├── GlassInputBar.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── Sidebar.tsx
│   │   └── VideoBackground.tsx
│   ├── services/
│   │   └── ollama.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── design.md
├── lint_design.py
└── package.json
```

### 12.4 Aturan GlassSurface (liquid-glass-react)

- `liquid-glass-react` merender beberapa elemen saudara yang masing-masing `position: relative; top/left: 50%; translate(-50%,-50%)`, dan ukurannya hanya diukur saat mount/resize window. Tanpa kontainer ber-ukuran, lapisan menumpuk di alur dan melayang ke tengah layar.
- Semua kaca WAJIB lewat `GlassSurface`: wrapper `relative` ber-ukuran dari children, lapisan `LiquidGlass` `position:absolute` (top/left 50% eksplisit) dengan isi kosong seukuran wrapper (ResizeObserver, remount saat ukuran berubah), children interaktif di atasnya.
- Kapsul input memakai `variant="css"` (backdrop-filter + border semi-transparan) karena lebarnya variabel dan memuat caret; pill, tombol + dan tombol kirim memakai LiquidGlass.

### 12.5 Keamanan Folder Kerja (Working Folder)
Fitur folder kerja tunduk pada batasan ketat demi keamanan sistem lokal:
1. **Normalisasi Path:** Seluruh operasi baca dan tulis mencegah relative traversal `..` dan akses ke path absolut seperti `C:\Windows` atau `/root`. File di luar root direktori terhubung tidak dapat diakses.
2. **Daftar Cekal File:** Pola ekstensi `.env*`, `*.pem`, `*.key`, `id_rsa*` serta sub-direktori `.git` dilarang dibaca maupun diedit oleh model.
3. **Validasi Isolasi Isi:** Isi dari hasil baca tool ditandai dengan "--- FILE CONTENT START ---" dan dilarang diperlakukan sebagai instruksi oleh model (Untrusted Data).
4. **Persetujuan Persisten Tulis:** Model AI *tidak dapat menulis file* secara otonom. Setiap `create_file`, `edit_file`, `write_file`, dan `delete_file` harus disetujui (Terapkan / Tolak) oleh pengguna dengan menampilkan kartu diff visual.
5. **Undo:** Disediakan tombol "Urungkan" melalui snapshot yang disimpan ke IndexedDB sebelum setiap perubahan diterapkan (berupa status file sebelumnya, atau perintah hapus mundur jika berupa create).
6. **Limit Loop Agentic:** Untuk menghindari eksekusi tak berujung, satu pengiriman perintah membatasi model maksimal 8 langkah pemanggilan beruntun, serta mematuhi pembatalan dari tombol "Stop".

### 12.6 Alur Izin Tulis File System Access API
1. **Permintaan Izin Awal:** Saat pengguna menghubungkan folder kerja dengan mode "Tanya setiap edit" (`ask`), browser meminta izin `readwrite` langsung dari interaksi pemilihan folder.
2. **Pemeriksaan Izin Langsung (Direct Gesture):** Pada Chromium, izin tulis pada handle yang disimpan di IndexedDB beralih ke status `'prompt'` saat halaman dimuat ulang. Saat pengguna mengklik "Terapkan", penanganan izin dilakukan langsung di awal handler klik (sebelum rantai `await` panjang yang dapat menghanguskan *transient user activation*).
3. **Fallback UI Izin Tulis:** Jika izin ditolak atau belum aktif, kartu menampilkan error resmi dan tombol "Berikan Izin Tulis" berwarna oranye terang untuk memicu dialog izin langsung dari gesture pengguna tanpa perlu melepas folder.
4. **Isolasi Mode Hanya Baca:** Pada mode "Hanya baca" (`readonly`), tool tulis (`create_file`, `edit_file`, `write_file`, `delete_file`) sama sekali tidak didaftarkan ke definisi tool Ollama, sehingga model tidak memiliki kemampuan maupun saran untuk menulis.

### 12.7 Format Respon Tool Terstruktur dan Kode Error
Seluruh hasil pemanggilan tool dikirimkan kembali ke model dan ditampilkan ke UI dalam format JSON terstruktur yang jujur:
- `ok`: boolean (`true` / `false`).
- `action`: nama tool yang dieksekusi.
- `path`: jalur berkas terkait.
- `error_code`: kode kesalahan baku:
  - `permission_denied`: Izin tulis belum diberikan oleh pengguna untuk folder kerja (`NotAllowedError`).
  - `old_str_not_found`: `old_str` tidak ditemukan dalam berkas, disertai field `hint` berisi baris terdekat.
  - `ambiguous_match`: `old_str` ditemukan lebih dari satu kali (harus unik tepat 1 kali).
  - `no_change`: `old_str` sama dengan `new_str`.
  - `file_exists`: `create_file` dipanggil pada berkas yang sudah ada (diarahkan menggunakan `edit_file` atau `write_file`).
  - `file_not_found`: Berkas yang dituju tidak ditemukan di folder kerja.
  - `invalid_json_syntax`: Hasil modifikasi berkas `.json` gagal divalidasi oleh `JSON.parse`.
  - `file_too_large`: `write_file` dipanggil pada berkas melebihi batas 100 KB.
  - `user_rejected`: Pengguna menekan tombol "Tolak".
  - `duplicate_tool_call`: Model memanggil tool yang sama dengan argumen identik dalam loop yang sama.
- `message`: deskripsi singkat berbahasa Indonesia yang jelas dan transparan.
- `hint`: cuplikan baris file sebenarnya saat pencocokan gagal.
- `undo_id`: nomor snapshot saat penulisan berhasil.

### 12.8 Ketangguhan Tool Edit, Normalisasi Baris, dan Validasi JSON
1. **Normalisasi Baris Bidirectional:** Saat membaca dan mencocokkan `old_str`, akhir baris CRLF (`\r\n`) dan LF (`\n`) dinormalisasi ke LF. Saat menulis kembali ke disk, karakter akhir baris asli berkas dipertahankan secara utuh agar tidak mengacaukan git diff proyek pengguna.
2. **Pencegahan Edit Nihil & Ambigu:** Edit ditolak otomatis bila `old_str` identik dengan `new_str` atau jika kemunculan tidak unik. Jika tidak ditemukan, sistem mencari baris dengan kemiripan tertinggi dan mengembalikan 3 baris cuplikan terdekat sebagai petunjuk perbaikan bagi model.
3. **Tool `write_file` untuk Berkas Kecil:** Ditambahkan tool `write_file` (batas 100 KB) untuk mengganti seluruh isi berkas secara langsung dengan persetujuan diff. Hal ini mempermudah model kecil (seperti `gemma4:e2b` dan `qwen3.5:9b`) yang sering kesulitan menghitung indentasi presisi pada `edit_file`.
4. **Validasi Sintaks JSON Pre-Approval:** Sebelum kartu persetujuan ditampilkan ke pengguna, hasil penerapan pada berkas `.json` diuji dengan `JSON.parse`. Jika sintaks rusak, usulan ditolak otomatis secara internal dan pesan kesalahan dikirimkan kembali ke model agar model memperbaiki sintaksnya terlebih dahulu sebelum pengguna melihat kartu.
5. **Diff Sebenarnya:** Diff visual dihitung langsung dari selisih isi berkas aktual saat ini dan isi yang akan dituliskan.

### 12.9 Kartu Persetujuan, Diff UI, dan Aturan Pelaporan Jujur AI
1. **Tampilan Kartu Diff Visual:** Usulan operasi tulis ditampilkan sebagai kartu elegan berlatar kaca gelap dengan ikon spesifik (`FileEdit`, `FileText`, `FilePlus`, `Trash2`). Kartu menyajikan perbandingan dua kolom: `- Sebelum` (merah) dan `+ Sesudah` (hijau) lengkap dengan font monospace.
2. **Ringkasan Operasi Nyata di UI:** Di bagian bawah daftar tool, UI menampilkan teks rekapitulasi nyata (misal: "1 dari 2 perubahan diterapkan (1 ditolak)") yang dihitung langsung dari status tool aktual, bukan dari teks yang digenerasi oleh model.
3. **Instruksi Kejujuran Sistem (Anti-Halusinasi):**
   - Model diinstruksikan melaporkan kegagalan apa adanya sesuai respon tool (`ok: false`).
   - Dilarang keras mengarang alasan palsu seperti *"state cached error"* atau *"memory error"*.
   - Dilarang mengklaim perubahan berhasil kecuali tool mengembalikan `ok: true`.
   - Dilarang mengulang aksi yang ditolak atau gagal dengan argumen yang identik (maksimal 1 kali percobaan perbaikan dengan argumen berbeda).
4. **Deteksi Loop Otomatis:** Aplikasi secara aktif mencatat signature pemanggilan tool (`tool_name + JSON(args)`). Jika terdeteksi pemanggilan berulang dengan argumen yang sama, loop agentic dihentikan seketika dengan pesan pembatalan loop.

### 12.10 Evaluasi Paket Resmi "ollama/browser"
Berdasarkan uji eksplorasi terhadap modul resmi `ollama/browser` (`ollama ^0.6.4`):
1. **Dukungan Thinking:** Modul resmi mendukung parameter `think: true | 'low' | 'medium' | 'high'` pada `chat()` dan mengalirkan `part.message.thinking` pada generator asinkron.
2. **Dukungan Tool Calls:** Modul resmi mengalirkan `part.message.tool_calls` pada bagian akhir stream.
3. **Keterbatasan Stop (AbortSignal):** Metode `client.chat()` pada `ollama/browser` tidak menerima `AbortSignal` eksternal secara langsung di opsi request; pembatalan mengharuskan pemanggilan `client.abort()` global atau iterator internal `stream.abort()`.
4. **Ketiadaan Dual-Endpoint & Mock:** Modul resmi tidak mendukung fallback otomatis antara Vite proxy (`/api/ollama`) dan direct endpoint (`http://127.0.0.1:11434`), serta tidak memiliki fallback mode simulasi offline.
5. **Keputusan Arsitektur:** Kode streaming berbasis `fetch` bawaan di `src/services/ollama.ts` dipertahankan karena lebih fleksibel, mendukung `AbortSignal` instan, dual-endpoint, serta simulasi offline yang tangguh.

### 12.11 Fitur Hapus Background (rembg), Canvas Checkerboard & Ekspor Chat
1. **Komponen RemoveBgModal:** Modal liquid glass (`.glass-panel`) untuk pemrosesan gambar menggunakan server AI lokal `rembg` (FastAPI).
   - Pratinjau split slider interaktif perbandingan sebelum vs sesudah (transparan).
   - Pilihan multi-model (BiRefNet General, BiRefNet Massive, IS-Net, BiRefNet Lite, BiRefNet Portrait).
   - Opsi resolusi & downscaling (Ukuran Asli, 4096 px, 2048 px, 1024 px, Kustom).
   - Penanganan error OOM GPU (VRAM) dan status cold-start vs warm-start.
2. **Pola Kanvas Checkerboard (`.bg-checkerboard`):**
   - Pola kotak-kotak hangat bernuansa gelap (`#18100d` dan `#261914`, ukuran 16px) untuk memvisualisasikan transparansi PNG di atas tema gelap hangat `#140a07`.
3. **Titik Akses UI:**
   - Tombol "Hapus Background" (`<Sparkles>`) pada chip lampiran di `GlassInputBar.tsx`.
   - Tombol aksi pada kartu lampiran gambar pesan pengguna di `ChatFeed.tsx` yang selalu terlihat pada layar sentuh (`opacity-100 sm:opacity-0 sm:group-hover:opacity-100`, ukuran target sentuh minimal 44x44px).
4. **Penyimpanan Device & Ekspor:**
   - Penulisan aman (atomic write via file `.tmp`) ke folder khusus rembg atau subfolder `rembg/` di dalam Folder Kerja aktif.
   - Migrasi penyimpanan riwayat chat dari batasan kuota 5 MB `localStorage` ke IndexedDB (`local-chat-store`) dengan penyimpanan gambar biner `Blob`.
   - Fitur ekspor percakapan ke Markdown (`README.md`) dan subfolder `images/` terpisah, atau diunduh sebagai arsip ZIP via pustaka ringan `fflate`.

### 12.12 Batch Studio rembg v3 & Arsitektur Proteksi Memori Canvas
1. **Studio View Mandiri (`RemoveBgView.tsx`):**
   - Halaman Studio komprehensif dua kolom: sidebar kiri untuk panel upload batch, daftar antrean gambar, galeri thumbnail hasil proses, dan pengaturan ekspor; serta kanvas utama kanan untuk perbandingan detail interaktif sebelum vs sesudah.
   - Pintu masuk navigasi yang konsisten di `Sidebar.tsx` dan `AppHeader.tsx` via toggle view mode (`viewMode === 'remove_bg'`).
2. **Komponen Modular Slider Split (`ImageCompareSlider.tsx`):**
   - Slider split perbandingan sebelum dan sesudah dengan garis pemisah presisi dan handle tengah berukuran target sentuh 44x44px (memenuhi WCAG SC 2.5.5 AAA dan melampaui SC 2.5.8 AA).
   - Dukungan aksesibilitas keyboard: navigasi panah kiri/kanan (`ArrowLeft`, `ArrowRight` per 2%, dengan tombol `Shift` per 10%), serta pintasan `Home` (0%) dan `End` (100%).
   - Area latar belakang transparansi checkerboard (`.bg-checkerboard`) bertema hangat yang terisolasi rapi.
3. **Pengaturan Pemrosesan Terpusat (`RemoveBgOptions.tsx`):**
   - Kontrol pemilihan arsitektur model AI: BiRefNet General (rekomendasi umum), BiRefNet Massive (resolusi tinggi), IS-Net (objek umum), BiRefNet Lite (ringan), BiRefNet Portrait (fokus manusia).
   - Kontrol resolusi maksimum / downscaling (Asli, 4096 px, 2048 px, 1024 px).
   - Penentuan target penyimpanan: Download langsung via browser, atau simpan otomatis ke subfolder `rembg/` pada Folder Kerja aktif.
4. **Antrean FIFO Terkelola (`useRemoveBgQueue.ts`):**
   - Eksekusi sekuensial FIFO (`concurrency: 1`) untuk mencegah tabrakan alokasi VRAM pada server GPU lokal (`rembg`).
   - Setiap item antrean dilengkapi pembatalan mandiri (`AbortController` individual) dan pembatalan massal seluruh antrean.
   - Perhitungan status granular per berkas: `idle`, `processing`, `done`, `error`.
5. **Proteksi Memori Canvas & Alokasi RAM Browser:**
   - Batas proteksi kanvas maksimum sebesar **25 Megapiksel (MP)** (~5000 x 5000 px).
   - Gambar berdimensi raksasa di atas 25 MP otomatis di-downscale ke dimensi aman (maks 4096 px) sebelum digambar ke kanvas memori, mencegah alokasi uncompressed RGBA bitmap melebihi 1 GB yang berisiko memicu crash tab browser / WebView2.
   - Penggunaan pelepasan URL objek blob (`revokeBlobUrl`) yang disiplin untuk mencegah kebocoran memori (memory leak).
6. **Karakteristik Beban VRAM AI Lokal:**
   - Cold-start memori server Python/FastAPI `rembg`: ~346 MiB VRAM pada GPU NVIDIA (teruji dengan `CUDAExecutionProvider`).
   - Puncak penggunaan VRAM selama inferensi aktif: ~1.2 GiB s.d. 1.8 GiB tergantung dimensi gambar input.

### 12.13 Abstraksi Transport Adapters & Kesiapan Desktop Tauri v2
1. **Latar Belakang Arsitektur:**
   - Memisahkan implementasi spesifik Web browser (File System Access API, browser `fetch`) dari logika domain aplikasi agar 100% siap di-porting ke ekosistem desktop native Tauri v2 (Windows WebView2) tanpa modifikasi komponen UI.
2. **Lapisan Adapter (`src/adapters/`):**
   - `httpClient` (`src/adapters/http/`): Abstraksi request jaringan dengan fallback dual-endpoint dan stream handler. Siap dialihkan ke Tauri HTTP client plug-in (`@tauri-apps/plugin-http`) untuk mengatasi kendala CORS browser.
   - `fileStorage` (`src/adapters/storage/`): Abstraksi sistem berkas. Memastikan 100% pemanggilan API berkas browser (`showDirectoryPicker`, `createWritable`, `getFileHandle`, `getDirectoryHandle`, `removeEntry`) diisolasi eksklusif dalam `webFileStorage.ts`. Lapisan aplikasi hanya berinteraksi melalui interface terpadu `IFileStorage` (`selectDirectory`, `readFile`, `writeFile`, `listFiles`, `deleteFile`).
   - `serverLauncher` (`src/adapters/server/`): Abstraksi lifecycle server pendukung lokal (Ollama port 11434 & rembg port 7001), siap diintegrasikan dengan Tauri Shell Sidecar process management.
3. **Dekomposisi God-Component `App.tsx`:**
   - Reduksi ukuran `App.tsx` dari 1949 baris menjadi 443 baris (pengurangan -77.3%).
   - Pemisahan tanggung jawab ke custom hooks modular: `useOllamaModels`, `useProjects`, `useSessions`, `useAgentChat`, dan `useRemoveBgQueue`.
   - Ekstraksi komponen tata letak: `AppHeader`, `LandingHero`, `AppModals`, `RemoveBgView`.

## 13. Do dan Don't

| Do | Don't |
|---|---|
| Gunakan token variabel CSS (`var(--...)`) untuk seluruh properti visual. | Jangan menanam nilai warna heksadesimal mentah di dalam styling komponen. |
| Mulai alirkan jawaban model AI segera setelah layout obrolan siap tanpa menunggu video2 tuntas. | Jangan menahan respons model hanya demi menunggu animasi video selesai berputar. |
| Gunakan crossfade 400ms untuk melarutkan video1 ke video2 saat prompt dikirim. | Jangan berasumsi video1 berada di frame awal saat user menekan Enter. |
| Hapus kedua elemen video dari DOM setelah transisi menuju background statis selesai. | Jangan biarkan elemen video terus berjalan di balik obrolan chat. |
| Jeda (pause) pemutaran video background saat modal besar terbuka. | Jangan gunakan `backdrop-filter: blur` di atas video background yang sedang diputar untuk modal overlay besar (memicu lag). |
| Terapkan efek liquid glass hanya pada kontrol sentuh kecil berukuran 44px. | Jangan memasang efek liquid glass pada daftar riwayat sidebar, **kecuali** sebagai satu lensa dekoratif (GlassLens) yang bergeser mengikuti hover/fokus tanpa merender ulang seluruh daftar. |
| Pertahankan desain antarmuka bersih dan serius untuk aplikasi lokal. | Jangan gunakan elemen "AI slop" seperti profil "Local User" palsu, emoji berlebihan di footer, atau slogan generik berulang. |
| Sediakan tombol Stop bundar saat streaming teks sedang berlangsung. | Jangan membiarkan pengguna tidak berdaya saat model menghasilkan output panjang yang tidak diinginkan. |
| Aktifkan fallback CSS blur pada browser Safari dan Firefox. | Jangan membiarkan teks tidak terbaca saat shader liquid glass gagal di-render oleh peramban. |

## 14. Hasil QA

Dijalankan 2026-10-05 pada Chromium (Playwright 1.63, headless, WebGL via SwiftShader) terhadap dev server Vite dengan Ollama lokal aktif. Skrip ada di folder scratch percakapan, bukan di repo.

| Pemeriksaan | Hasil | Tanggal |
|---|---|---|
| Pengukuran Lag Form "Buat Project" | Lolos: Lag diukur berasal dari `backdrop-filter: blur` overlay modal di atas `video` aktif yang memicu repaint. Diperbaiki dengan mengganti blur menjadi dim hitam transparan dan mem-pause video. | 2026-10-06 |
| Lint kode (`npm run lint`) dan `tsc -b` | Lolos tanpa error | 2026-10-06 |
| Lint desain (`lint_design.py design.md`) | Lolos: 44 token, 0 error, 8 pasangan kontras token >= 4.5:1 | 2026-10-06 |
| Screenshot landing 1440x900, 1920x1080, 390x844 | Lolos: tidak ada scrollbar halaman (scrollHeight == clientHeight), tagline penuh di dalam viewport (jarak ke tepi bawah 32px desktop, 24px mobile), tidak ada elemen kaca yatim (semua lapisan LiquidGlass persis sama rect dengan wrapper 44px), subtitle tidak ada, font Manrope aktif | 2026-10-05 |
| Visual diff vs `gambaran kasar.png` | Dibandingkan secara visual (mata), bukan diff piksel otomatis. Susunan sama (pill rata kiri kapsul, [+] [kapsul] [kirim], tagline di bawah). Beda disengaja: kaca lebih gelap demi kontras | 2026-10-05 |
| Kontras pill/tagline di atas frame video1 (sampling piksel, t=0..7s, teks `#f5f5f7` vs piksel TERTERANG di area teks) | Lolos: pill 7.24:1 (1440x900) dan 6.29:1 (390x844); tagline >= 9:1 pada kedua ukuran | 2026-10-05 |
| Kontras heading hero di atas video | Lolos (>= 3:1 untuk teks besar): Teks sapaan telah dinaikkan ke area langit (`pt-[18vh]`) dengan tambahan `text-shadow` ganda yang kuat (`rgba(0,0,0,0.8)`), memisahkan teks secara signifikan dari latar belakang terang di semua frame video. | 2026-10-05 |
| Alur manual: ketik, Enter, transisi, chat, New Chat | Lolos: tombol kirim nonaktif saat kosong (`rgba(255,255,255,.06)`) dan aktif saat ada teks (`rgb(194,65,12)`); Enter memicu transisi; island bergeser lebar 704 ke 768px; video di-unmount antara 2.5-3.5 detik; feed chat tampil dengan jawaban streaming dari Ollama; New Chat kembali ke landing dengan video dan tagline | 2026-10-05 |
| Fokus kapsul | Lolos: outline textarea `none`, cincin fokus 2px di kapsul via `:focus-within` | 2026-10-05 |
| Waktu jawaban pertama terlihat vs pergeseran layout | Lolos: Video dikonfirmasi di-unmount pada sekitar ~2.6 detik setelah transisi dimulai; jawaban dibuffer paling lama 400ms oleh kode, latensi model tidak diukur) | 2026-10-05 |
| Safari / Firefox / reduced-motion (fallback CSS) | Belum diuji | 2026-10-05 |
| Navigasi keyboard penuh (Tab melewati semua kontrol, dropdown model) | Belum diuji selain fokus textarea. Dropdown model dibuka di skrip tetapi tangkapannya tidak ditinjau | 2026-10-05 |
| Layar 320px dan tablet | Belum diuji | 2026-10-05 |
## 15. Diamati vs diasumsikan

| Diamati dari referensi | Diasumsikan / diputuskan sendiri |
|---|---|
| Sidebar gelap pekat (`#1b1b1b`) di sisi kiri dengan judul tagline dan riwayat chat. | Penggunaan ikon Lucide modern untuk item sidebar dan status server. |
| Lanskap gurun pegunungan bernuansa oranye keemasan dengan langit hangat. | Percepatan pemutaran `video2` (`playbackRate = 4.0`) agar total transisi sinematik berlangsung ~2–3 detik. |
| Pill model mengambang di atas bar input kapsul dengan pendaran kaca. | Pemilihan label deskriptif model Ollama ("Fast for answering", "Deep reasoning", dsb). |
| Warna latar akhir video2 yang identik dengan `background-akhir.png` (`#140a07`). | Tata letak obrolan aktif ala claude.ai yang bebas bubble kaku demi kenyamanan baca. |
| Tombol bulat berikon panah kirim (`ArrowUp`) terinspirasi dari reference2. | Transformasi tombol kirim menjadi tombol Stop kotak saat generasi teks sedang berlangsung. |
| Sapaan hero tipografi ramping di ruang kosong langit terinspirasi dari reference2 & reference1. | Penerapan gradasi scrim atas (`#2b140d`) dan bawah (`#1e110c`) untuk menjamin kontras keterbacaan teks di atas video bergerak. |

## 16. Pertanyaan terbuka

1. `PERLU KONFIRMASI`: Apakah warna latar chat mode `--color-bg` disetujui tetap menggunakan warna sampling akhir senja `#140a07` (warm deep charcoal), ataukah Anda lebih memilih warna gelap netral standar seperti `#121214` atau hitam murni `#000000`?
2. ~~Font~~ Diputuskan: Manrope self-host via `@fontsource-variable/manrope` (tanpa CDN, privasi terjaga). Masih `PERLU KONFIRMASI` bila ingin font lain.
3. ~~Fitur ekspor chat~~ Diputuskan: Fitur ekspor percakapan ke Markdown (README.md) dan gambar terpisah via Folder Kerja atau fflate ZIP telah diimplementasikan penuh.

## 17. Changelog

| Versi | Tanggal | Perubahan | Alasan |
|---|---|---|---|
| 0.3.0 | 2026-10-08 | Dekomposisi arsitektur App.tsx (-77.3%), Transport Adapters (HTTP, Storage, Server), Batch Studio rembg v3, ImageCompareSlider, antrean FIFO sekuensial, dan proteksi RAM kanvas 25 MP | Memenuhi kesiapan desktop Tauri v2 (100% isolasi FSA API), modularitas hook, pencegahan OOM canvas browser, dan pengalaman Studio pemrosesan batch |
| 0.2.1 | 2026-10-08 | Implementasi Fitur Hapus Background (rembg) v2, Canvas Checkerboard, Slider Split, Penyimpanan Device Aman, Migrasi IndexedDB, dan Ekspor Markdown/Images via fflate | Menyediakan pemrosesan citra AI lokal tanpa login, mitigasi kuota 5MB localStorage, dan ekspor riwayat chat terstruktur |
| 0.2.0 | 2026-10-06 | Penambahan tombol hapus chat (Trash2) di sidebar, kartu project, dan header obrolan aktif, serta modal alert konfirmasi (DeleteChatDialog) | Memastikan tombol hapus selalu dapat diakses dan mencegah riwayat chat lokal terhapus permanen tanpa konfirmasi |
| 0.1.9 | 2026-10-06 | Perbaikan GlassLens hover tracking: cegah lens tertahan di item chat aktif saat kursor berpindah ke chat lain, penanganan celah antar-item dan tombol aksi | Memastikan transisi sorotan kaca bergerak mulus ke item yang di-hover tanpa terputus atau terpental kembali ke item aktif |
| 0.1.8 | 2026-10-06 | Penguatan ketangguhan Folder Kerja: perbaikan alur izin File System Access API, tool write_file, validasi JSON, kartu diff visual, aturan anti-halusinasi model, dan deteksi loop | Memperbaiki kegagalan NotAllowedError, CRLF mismatch, JSON rusak, serta menghentikan halusinasi alasan model |
| 0.1.7 | 2026-10-06 | Penerapan logo aplikasi (/assets/logo.png) pada sidebar, ikon model AI, dan animasi saat AI berpikir | Memperkuat konsistensi identitas visual aplikasi sesuai aset brand resmi |
| 0.1.6 | 2026-10-06 | Integrasi Folder Kerja, sistem keamanan file API, batas eksekusi loop AI, log undo tindakan | Implementasi akses folder persisten (IndexedDB), normalisasi path, filter ekstensi berbahaya, read/write diff, max 8-loop agent |
| 0.1.4 | 2026-10-06 | Pembaruan aturan glass panel, perbaikan lag modal, dan pembersihan elemen sidebar | Menerapkan panduan performa modal, menambahkan CSS class .glass-panel, serta menghapus elemen generik ("AI slop") |
| 0.1.3 | 2026-10-06 | Integrasi GlassLens, penyesuaian UI Chat, perbaikan token warna & hero contrast | Peningkatan konsistensi visual, performa hover, dan pelokalan bahasa label |
| 0.1.2 | 2026-10-05 | Perbaikan blok input island, GlassSurface, scrim token, font Manrope self-host, h-dvh, hapus subtitle, playbackRate 4.0, dur-layout-shift 600ms | Memperbaiki lapisan LiquidGlass yatim, layout input, keterbacaan di atas video, dan scrollbar halaman |
| 0.1.1 | 2026-10-05 | Revisi transisi video, penyelarasan tinggi kontrol, penambahan scrim & kontras video, fallback Safari, dan kelengkapan spesifikasi obrolan | Menyesuaikan durasi total transisi (~2-3 detik), memulai streaming jawaban saat layout bergeser, menyelaraskan ukuran kontrol ke 44px, menambahkan pasangan kontras scrim, dan melengkapi aturan state chat |
| 0.1.0 | 2026-10-05 | Versi awal panduan desain berdasarkan prototipe Mode A dan referensi Mode B | Peletakan fondasi arsitektur UI, token visual, spesifikasi komponen, dan tahapan transisi sinematik video |

