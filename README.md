# BatikLens - Monolithic Architecture (React + Flask + MySQL)

Proyek ini menggunakan arsitektur "Monolitik-Hybrid", di mana Anda dapat menjalankan aplikasi dalam dua mode: **Development Mode** (Vite Dev Server + Flask API) untuk live coding, atau **Production/Monolithic Mode** (di mana Flask melayani file statis React yang telah di-build dari folder `dist`) dengan memanfaatkan **MySQL** sebagai database utamanya.

---

## 📋 Syarat Sistem (System Prerequisites)

Sebelum memulai, pastikan sistem Anda memiliki komponen berikut:
1. **Node.js (versi 18+) & NPM** - Untuk instalasi package dan build frontend React.
2. **Python (versi 3.9 s.d. 3.11)** - Untuk menjalankan API server Flask dan model kecerdasan buatan PyTorch LeViT.
3. **MySQL Server** - Dapat berupa XAMPP, Laragon, Docker MySQL, ataupun instalasi native MySQL Server.

---

## 🛠️ Langkah Setup Pertama Kali (Dari Nol)

### 1. Klon / Unduh Kode Sumber
Pastikan seluruh folder proyek ini berada pada folder kerja Anda di local computer.

### 2. Siapkan Database MySQL
1. Pastikan service MySQL Server Anda telah menyala (misal: aktifkan MySQL melalui control panel XAMPP).
2. Hubungkan ke database client Anda (misal: phpMyAdmin atau MySQL Workbench).
3. Buat database baru kosong bernama **`batiklens`**:
   ```sql
   CREATE DATABASE batiklens;
   ```

### 3. Konfigurasi Environment Variables (`.env`)
Salin file `.env.example` menjadi `.env` di root folder proyek:
- Atur parameter `DATABASE_URL` menggunakan kredensial MySQL lokal Anda.
- **Format URL**: `mysql+pymysql://<username>:<password>@<host>:<port>/<database>`
- **Contoh default (tanpa password / XAMPP)**:
  ```env
  DATABASE_URL="mysql+pymysql://root:@localhost:3306/batiklens"
  ```
- Jika Anda memiliki API key Gemini untuk fitur AI kustom, silakan cantumkan juga pada `.env` Anda.

---

## 🚀 Migrasi & Seeding Database (Otomatis & Manual)

Dalam proyek ini, **Migrasi dan Seeding berjalan otomatis secara cerdas pada saat Flask Server dinyalakan!**

Ketika Flask dijalankan, sistem akan mendeteksi skema database Anda:
1. **Migrasi**: Menghapus tabel lama yang tidak sinkron dan membuat ulang seluruh tabel relasional (Admin, Pegawai, Customer, Data Motif, Hasil Prediksi, Hasil Validasi, Feature Map, Attention Map, Laporan) menggunakan `db.create_all()` via SQLAlchemy.
2. **Seeding Otomatis**: Jika database dalam keadaan kosong, script inisialisasi di `backend/app.py` akan otomatis mengisikan:
   * **Akun Admin Default**: Username `admin` / Password `admin123` (Nama: *Ibu Halimah*)
   * **Akun Pegawai Default**: Username `pegawai` / Password `pegawai123` (Nama: *Rian Hidayat*)
   * **Pustaka 39 Motif Batik Kaggle**: Berisi data lengkap asal daerah, makna filosofis mendalam, peruntukan acara, dan placeholder gambar dari Unsplash.
   * **Data Histori Pengujian & Analitik**: Record simulasi uji citra, hasil validasi format, akurasi klasifikasi, hingga laporan bulanan berkala untuk memastikan dashboard grafik analitik langsung tampil interaktif dengan data kaya sejak detik pertama!

---

## ⚙️ Menjalankan Aplikasi di Laptop Anda

Anda dapat memilih satu dari dua mode berikut:

### 💡 Pilihan A: Mode Pengembangan (Vite Dev Server + Flask Server) — *Sangat direkomendasikan untuk Modifikasi Kode*

Dalam mode ini, Anda dapat mengubah file React di `/src` secara real-time.

1. **Jalankan Backend (Flask API)**:
   Buka terminal baru di folder utama proyek dan masuk ke direktori `backend`:
   ```bash
   cd backend
   python -m venv venv
   
   # Aktifkan Virtual Environment:
   # Di Windows (CMD/PowerShell):
   venv\Scripts\activate
   # Di macOS / Linux:
   source venv/bin/activate
   
   # Instalasi dependencies backend:
   pip install -r requirements.txt
   
   # Jalankan Server Flask:
   python app.py
   ```
   *Flask Server akan aktif di port default: **http://localhost:5000***

2. **Jalankan Frontend (React + Vite)**:
   Buka terminal terpisah di root folder utama proyek:
   ```bash
   # Instalasi package frontend:
   npm install
   
   # Jalankan Vite Development Server:
   npm run dev
   ```
   *Vite Dev Server akan berjalan (biasanya di **http://localhost:3000** atau **http://localhost:5173**). Vite dikonfigurasi otomatis mem-proxy request `/api/*` langsung ke server Flask di port 5000.*

---

### 📦 Pilihan B: Mode Produksi Monolitik (Hanya Perlu Menjalankan 1 Server Flask)

Dalam mode ini, backend Flask Anda bertindak sebagai satu-satunya server monolithic yang menghidangkan frontend statis sekaligus melayani API endpoint.

1. **Build Frontend React**:
   Buka terminal di root folder utama proyek, lalu compile React menjadi aset statis:
   ```bash
   npm install
   npm run build
   ```
   *(Perintah ini akan mengompilasi kode ke dalam folder `/dist` di root proyek).*

2. **Jalankan Monolithic Backend**:
   Buka terminal di folder `backend`, aktifkan virtual environment, lalu jalankan Flask:
   ```bash
   cd backend
   # Pastikan venv aktif
   python app.py
   ```
3. **Akses Aplikasi**:
   Buka browser Anda dan akses: **http://localhost:5000** 🎉
   *Flask secara otomatis akan melayani halaman web dari folder `/dist` dan memproses seluruh logika interaksi database MySQL.*

---

## 🔐 Kredensial Akun Default untuk Login:
* **Admin**:
  * Username: `admin`
  * Password: `admin123`
* **Pegawai (Frontoffice Staff)**:
  * Username: `pegawai`
  * Password: `pegawai123`
