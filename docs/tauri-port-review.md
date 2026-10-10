# Tinjauan Analisis Porting Tauri v2 (Windows 11, WebView2)

Dokumen ini mencatat hasil verifikasi faktual terhadap dokumentasi resmi Tauri v2 (`/websites/tauri_app` dan `/tauri-apps/plugins-workspace`) serta uji perintah CLI sebelum mengeksekusi modifikasi kode.

---

## 1. Poin yang Dikonfirmasi & Temuan Faktual

### Poin 1: Flag Perintah `tauri init`
- **Status:** Terkonfirmasi via `npx @tauri-apps/cli init --help`.
- **Hasil:**
  - Opsi direktori aset web adalah `-D, --frontend-dist <FRONTEND_DIST>` (relatif terhadap `src-tauri`, bernilai `"../dist"`).
  - Opsi URL server dev adalah `-P, --dev-url <DEV_URL>` (`"http://localhost:5173"`).
  - Flag `--dist-dir` dari Tauri v1 sudah usang. Gunakan `--ci` untuk bypass prompt interaktif.

### Poin 2: Shell Plugin & Spawning Proses rembg
- **Status:** Terkonfirmasi via dokumentasi dan kode sumber `plugins/shell`.
- **Hasil:**
  - `shell:default` hanya mengizinkan `open` (membuka file/URL eksternal).
  - Untuk men-spawn script Python / batch rembg secara terisolasi tanpa membuka shell bebas, diperlukan `shell:allow-spawn` dengan scope eksplisit di capabilities.
  - Format konfigurasi capability di `src-tauri/capabilities/default.json`:
    ```json
    {
      "identifier": "shell:allow-spawn",
      "allow": [
        {
          "name": "run-rembg-python",
          "cmd": "python",
          "args": ["scripts/run_rembg.py", "--host", "127.0.0.1", "--port", "7000", "--no-ui"],
          "sidecar": false
        },
        {
          "name": "run-rembg-bat",
          "cmd": "cmd",
          "args": ["/c", "start_rembg.bat"],
          "sidecar": false
        }
      ]
    }
    ```
  - Pemanggilan di guest TypeScript: `Command.create('run-rembg-python', [...]).spawn()`.

### Poin 3: Persistensi Scope File System (`tauri-plugin-persisted-scope`)
- **Status:** Terkonfirmasi di Rust, namun ditemukan perbedaan penting pada npm & permission.
- **Hasil Faktual:**
  - Dialog native runtime menambahkan direktori yang dipilih ke *in-memory scope* saja; saat restart aplikasi, izin tersebut hilang.
  - Crate Rust `tauri-plugin-persisted-scope = "2"` di `Cargo.toml` dan `.plugin(tauri_plugin_persisted_scope::init())` di `lib.rs` secara otomatis mempersistensikan scope runtime ke `scopes.json` di app data directory.
  - **Koreksi Penting:**
    1. **Tidak ada paket NPM:** `@tauri-apps/plugin-persisted-scope` tidak ada di registry npm (404 Not Found). Plugin ini berjalan 100% di sisi Rust tanpa wrapper guest JS.
    2. **Tidak ada permission `allow-save` / `allow-load`:** Izin tersebut adalah milik `tauri-plugin-store`. `persisted-scope` bekerja otomatis di setup hook Rust dan tidak memerlukan entri permission khusus di capabilities JSON.

### Poin 4: Deteksi Runtime Resmi (`isTauri()`)
- **Status:** Terkonfirmasi via `@tauri-apps/api/core`.
- **Hasil:**
  - Fungsi resmi: `import { isTauri } from '@tauri-apps/api/core';`.
  - Mengembalikan `true` di webview desktop Tauri dan `false` di web browser standar. Cek manual `__TAURI_INTERNALS__` tidak digunakan.

### Poin 5: Sintaks Scope URL HTTP (`http:default`)
- **Status:** Terkonfirmasi via kode sumber `plugins/http/src/scope.rs` dan schema `plugins/http/build.rs`.
- **Hasil:**
  - Pattern URL mengikuti standar WHATWG `URLPattern`.
  - `http:default` mengizinkan operasi fetch tetapi memerlukan konfigurasi scope origin eksplisit.
  - Konfigurasi izin di `capabilities/default.json`:
    ```json
    {
      "identifier": "http:default",
      "allow": [
        "http://127.0.0.1:11434/*",
        "http://127.0.0.1:7000/*"
      ]
    }
    ```

### Poin 6: Konfigurasi & Pengetatan CSP di `tauri.conf.json` v2
- **Status:** Terkonfirmasi via dokumentasi schema `tauri.conf.json` v2.
- **Hasil:**
  - Letak kunci CSP: `"app": { "security": { "csp": "..." } }`.
  - **Pengetatan Maksimal:** Karena seluruh request ke Ollama (:11434) dan rembg (:7000) dijalankan via `plugin-http` di proses Rust backend (melalui IPC), `connect-src http://127.0.0.1:*` **tidak diperlukan** di CSP browser webview.
  - `unsafe-eval` juga **tidak diperlukan** karena bundle Vite/React 19 tidak mengeksekusi `eval()`.
  - Nilai CSP ketat yang direkomendasikan:
    ```
    default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: asset: http://asset.localhost https://asset.localhost; media-src 'self' blob:; connect-src 'self' ipc: http://ipc.localhost blob:;
    ```

### Poin 7: Origin Ollama & Uji Nyata Streaming
- **Status:** Terverifikasi secara empiris melalui build nyata Tauri (`target\release\app.exe` dan `target\debug\app.exe`).
- **Hasil Pengujian Nyata:**
  - Uji live streaming dijalankan **tanpa** mengaktifkan fitur `unsafe-headers` di `Cargo.toml`.
  - Frontend memanggil `httpClient.fetch('http://127.0.0.1:11434/api/tags')` dan `http://127.0.0.1:11434/api/chat` (model `gemma4:e2b`, payload streaming).
  - **Hasil Empiris:**
    - HTTP Status: `200 OK`
    - Streaming: Mengalir sukses (`streamingFlowing: true`, token stream pertama diterima dalam ~400ms).
    - Status API Tags: `200 OK`
  - **Kesimpulan & Keputusan:** Fitur `unsafe-headers` **TIDAK diperlukan**. Setup `tauri-plugin-http = "2"` standar dipertahankan agar tidak membuka celah keamanan header yang tidak perlu.

### Poin 8: Ekspor ZIP & Unduhan Blob
- **Status:** Terkonfirmasi dan terimplementasi dengan strategi hybrid desktop native.
- **Hasil:**
  - Di desktop Tauri (`isTauri()`): Menggunakan dialog native via `@tauri-apps/plugin-dialog` `save({ defaultPath: '...', filters: [{ name: 'ZIP archive', extensions: ['zip'] }] })` lalu menulis byte array via `@tauri-apps/plugin-fs` `writeFile`.
  - Di web browser (`!isTauri()`): Menggunakan unduhan fallback via atribut DOM `<a>` browser standar.

---

## 2. Versi Dependensi yang Dipakai

### NPM Packages (Client-Side)
- `@tauri-apps/cli`: `^2.12.1`
- `@tauri-apps/api`: `^2.12.2`
- `@tauri-apps/plugin-http`: `^2.8.1`
- `@tauri-apps/plugin-fs`: `^2.6.0`
- `@tauri-apps/plugin-dialog`: `^2.8.1`
- `@tauri-apps/plugin-shell`: `^2.4.1`

### Cargo Crates (Rust-Side)
- `tauri`: `2.12.1`
- `tauri-plugin-http`: `2` (fitur `unsafe-headers` dinonaktifkan sesuai hasil uji empiris 200 OK)
- `tauri-plugin-fs`: `2`
- `tauri-plugin-dialog`: `2`
- `tauri-plugin-shell`: `2`
- `tauri-plugin-persisted-scope`: `2`

---

## 3. Catatan Migrasi Riwayat Chat (Isolasi Origin Web vs Desktop)

Karena WebView2 di Windows menggunakan origin desktop khusus (`http://tauri.localhost`), penyimpanan IndexedDB dan localStorage pada aplikasi desktop terisolasi secara kriptografis dan terpisah dari browser web standar (misalnya `http://localhost:5173`):
1. **Tidak Ada Sinkronisasi Otomatis:** Sesi percakapan yang dibuat di browser web tidak akan muncul otomatis di dalam desktop app.
2. **Cara Memindahkan Riwayat:**
   - Gunakan fitur **Ekspor ZIP** (seluruh sesi) atau **Ekspor ke Folder Kerja** (menghasilkan `README.md` dan folder `images/`).
   - Pilih folder kerja yang sama di aplikasi desktop melalui tombol *Pilih Folder*.
   - Dokumen `README.md` dan gambar lampiran dapat dibaca langsung oleh model di lingkungan desktop melalui folder kerja lokal.
