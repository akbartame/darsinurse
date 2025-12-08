# 🏥 DARSINURSE GATEWAY
## Medical IoT Platform dengan Web Bluetooth API

**Darsinurse Gateway** adalah platform terintegrasi untuk manajemen data kesehatan pasien dengan koneksi perangkat medis IoT via Web Bluetooth API. Dibangun dengan Node.js + Express.js + Bootstrap 5.

---

## 🎯 FITUR UTAMA

✅ **Autentikasi Perawat** - Login dengan ID + Password (SQLite)  
✅ **Validasi Pasien** - Cek data pasien sebelum pengukuran  
✅ **Web Bluetooth API** - Koneksi nirkabel ke 5+ perangkat medis  
✅ **Real-time Dashboard** - Tampilkan hasil pengukuran langsung  
✅ **Auto Data Save** - Data langsung tersimpan ke database  
✅ **Activity Log** - Monitoring semua aktivitas perawat  
✅ **Responsive Design** - Tema profesional biru-hijau  

---

## 📋 PERANGKAT YANG DIDUKUNG

| Perangkat | Service UUID | Karakteristik | Status |
|-----------|------------|--------------|--------|
| **Tensimeter (BP)** | 0x1810 | 0x2A35 | ✅ |
| **Heart Rate Monitor** | 0x180D | 0x2A37 | ✅ |
| **Timbangan (Weight)** | 0x181D | 0x2A9D | ✅ |
| **Glukometer (Glucose)** | 0x1808 | 0x2A18 | ✅ |
| **SpO2 Sensor** | TBD | TBD | 🔄 (Siap ditambah) |

---

## ⚙️ INSTALASI CEPAT

### Prasyarat
- **Node.js** v14+ (https://nodejs.org)
- **npm** (included with Node.js)
- **Browser dengan Web Bluetooth** (Chrome, Edge, Opera)

### Langkah-langkah

```bash
# 1. Buat folder project
mkdir darsinurse-gateway
cd darsinurse-gateway

# 2. Inisialisasi npm
npm init -y

# 3. Install dependencies
npm install express express-session ejs body-parser better-sqlite3

# 4. Copy semua file:
# - server.js (root)
# - views/login.ejs
# - views/dashboard.ejs
# - public/style.css
# - public/script.js

# 5. Jalankan server
node server.js
```

**Output:**
```
╔════════════════════════════════════════╗
║  DARSINURSE GATEWAY - RUNNING          ║
║  Server: http://localhost:3000         ║
║  Database: darsinurse.db               ║
╚════════════════════════════════════════╝
```

---

## 🔐 LOGIN & AKUN DEMO

### Test Credentials (Dummy Data)

| ID Perawat | Password | Nama |
|-----------|----------|------|
| P001 | pass123 | Siti Nurhaliza |
| P002 | pass456 | Ahmad Wijaya |
| P003 | pass789 | Dewi Lestari |

### Test Patients

| ID Pasien | Nama | Alamat |
|----------|------|--------|
| PAT001 | Budi Santoso | Jl. Merdeka No. 10 |
| PAT002 | Susi Handini | Jl. Ahmad Yani No. 25 |
| PAT003 | Rudi Hermawan | Jl. Pemuda No. 30 |
| PAT004 | Ani Wijaya | Jl. Diponegoro No. 15 |

---

## 📱 CARA PENGGUNAAN

### 1️⃣ LOGIN
```
→ Buka http://localhost:3000
→ Masukkan ID Perawat: P001
→ Masukkan Password: pass123
→ Klik "Masuk Sekarang"
```

### 2️⃣ PILIH PASIEN
```
→ Di dashboard, masukkan ID Pasien (contoh: PAT001)
→ Klik tombol "Cari Pasien"
→ Tunggu validasi ✓
→ Tombol "Scan BLE" otomatis aktif
```

### 3️⃣ SCAN PERANGKAT
```
→ Hidupkan perangkat medis (tensimeter, glukometer, dll)
→ Pastikan dalam jangkauan ~10 meter
→ Klik tombol hijau "Scan & Ambil Data Alat BLE"
→ Pilih perangkat dari browser popup
→ Tunggu koneksi GATT berhasil
```

### 4️⃣ AMBIL PENGUKURAN
```
Sesuai jenis perangkat:

🩸 GLUKOMETER:
  → Lakukan tes glukosa pada pasien
  → Perangkat otomatis mengirim hasil
  → Data muncul di kotak "Glukosa"

💉 TENSIMETER:
  → Pasang manset pada lengan
  → Tekan tombol start di alat
  → Tunggu hasil pembacaan
  → Data muncul di kotak "Tensi"

❤️ HEART RATE:
  → Letakkan di dada/jari
  → Tunggu stabil
  → Data muncul di kotak "Detak Jantung"

⚖️ TIMBANGAN:
  → Pasien naik ke atas
  → Tunggu pembacaan selesai
  → Data muncul di kotak "Berat Badan"
```

### 5️⃣ DATA OTOMATIS TERSIMPAN
```
✓ Setiap pengukuran langsung:
  - Tampil di dashboard
  - Dikirim ke server via /simpan_data
  - Disimpan di database pengukuran
  - Ditampilkan di activity log
```

---

## 🗄️ STRUKTUR DATABASE

### Tabel: perawat
```sql
CREATE TABLE perawat (
  id_perawat TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  password TEXT NOT NULL,  -- SHA256 hash
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel: pasien
```sql
CREATE TABLE pasien (
  id_pasien TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  alamat TEXT,
  tanggal_lahir TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel: pengukuran
```sql
CREATE TABLE pengukuran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_perawat TEXT NOT NULL,
  id_pasien TEXT NOT NULL,
  tipe_device TEXT NOT NULL,
  data TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_perawat) REFERENCES perawat(id_perawat),
  FOREIGN KEY (id_pasien) REFERENCES pasien(id_pasien)
);
```

---

## 🔄 API ENDPOINTS

### 1. Login
```
POST /login
Body: {
  "id_perawat": "P001",
  "password": "pass123"
}
→ Redirect ke /dashboard jika berhasil
```

### 2. Validasi Pasien
```
GET /validasi_pasien/:id_pasien
Response: {
  "valid": true,
  "pasien": {
    "id_pasien": "PAT001",
    "nama": "Budi Santoso",
    "alamat": "...",
    "tanggal_lahir": "..."
  }
}
```

### 3. Simpan Data Pengukuran
```
POST /simpan_data
Headers: Content-Type: application/json
Body: {
  "id_perawat": "P001",
  "id_pasien": "PAT001",
  "tipe_device": "glukosa|tensimeter|heart_rate|timbangan",
  "data": "180" atau "125/80" atau "78" atau "68.5"
}
Response: {
  "success": true,
  "message": "Data glukosa berhasil disimpan",
  "id": 1,
  "timestamp": "2025-01-15T10:30:45.123Z"
}
```

### 4. Riwayat Pengukuran
```
GET /riwayat/:id_pasien
Response: {
  "success": true,
  "data": [
    {
      "tipe_device": "glukosa",
      "data": "180",
      "timestamp": "2025-01-15T10:30:45.123Z"
    },
    ...
  ]
}
```

### 5. Logout
```
GET /logout
→ Destroy session, redirect ke /
```

---

## 🔌 PARSING DATA BLE

### GLUKOSA (SFLOAT Format)
```javascript
// Bytes: [flags, mantissa_lo, mantissa_mid, mantissa_hi+exp]
function parseSFLOAT(bytes) {
  const mantissa = bytes[0] | (bytes[1] << 8) | ((bytes[2] & 0x0F) << 16);
  const exponent = (bytes[2] & 0xF0) >> 4;
  const exp = exponent > 7 ? exponent - 16 : exponent;
  return mantissa * Math.pow(10, exp);
}
// Output: nilai glukosa dalam mg/dL
```

### TENSIMETER (BP)
```javascript
// Bytes: [flags, systolic_lo, systolic_hi, diastolic_lo, diastolic_hi, ...]
// Output: "125/80" mmHg
const systolic = bytes[1] | (bytes[2] << 8);
const diastolic = bytes[3] | (bytes[4] << 8);
```

### HEART RATE
```javascript
// Bytes: [flags, value_lo] atau [flags, value_lo, value_hi]
// Flags bit 0: 0=uint8, 1=uint16
// Output: nilai BPM (beats per minute)
```

### BERAT BADAN
```javascript
// Bytes: [flags, weight_lo, weight_hi]
// Flags bit 0: 0=metric (÷200), 1=imperial (÷100)
// Output: kg atau lbs
```

---

## 📝 MENAMBAH PERANGKAT BARU

### Contoh: Tambah SpO2 Sensor

**1. Dalam script.js, tambah UUID:**
```javascript
const PULSE_OXIMETRY_SERVICE = 0x1822;
const SPO2_MEASUREMENT_CHAR = 0x2A5E;
```

**2. Tambah field di HTML dashboard:**
```html
<div class="col-lg-6">
  <div class="card card-measurement">
    <div class="measurement-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
      <i class="fas fa-lungs"></i>
    </div>
    <div class="measurement-content">
      <h6>SpO2 / Oksigen</h6>
      <div class="measurement-value" id="spo2-value">-</div>
      <small class="text-muted">%</small>
      <span id="spo2-source" class="badge badge-source" style="display: none;">BLE</span>
    </div>
  </div>
</div>
```

**3. Tambah handler:**
```javascript
function handleSpO2(event) {
  const value = event.target.value;
  const bytes = new Uint8Array(value.buffer);
  const spO2Value = bytes[1]; // Parse sesuai spec
  document.getElementById('spo2-value').textContent = spO2Value;
  sendToServer('spo2', spO2Value.toString());
}
```

**4. Tambah ke BLE scan loop:**
```javascript
try {
  const svc = await server.getPrimaryService(PULSE_OXIMETRY_SERVICE);
  const char = await svc.getCharacteristic(SPO2_MEASUREMENT_CHAR);
  await char.startNotifications();
  char.addEventListener('characteristicvaluechanged', handleSpO2);
} catch(e) {}
```

---

## 🐛 TROUBLESHOOTING

### ❌ "Browser tidak mendukung Web Bluetooth"
- Gunakan Chrome, Edge, atau Opera (v56+)
- Jika di MacOS/Linux, aktifkan Web Bluetooth di chrome://flags
- Di Windows, pastikan Bluetooth device sudah terkoneksi

### ❌ "Perangkat tidak ditemukan"
- Hidupkan perangkat medis
- Pastikan dalam jangkauan ~10 meter
- Restart perangkat
- Clear browser cache dan coba lagi

### ❌ "Data tidak terkirim ke server"
- Cek console browser (F12 > Console)
- Pastikan session login masih aktif
- Validasi ID Pasien terlebih dahulu
- Cek network tab di DevTools

### ❌ "Database error"
- Hapus file darsinurse.db
- Restart server
- Data dummy akan otomatis dibuat ulang

---

## 📊 SECURITY NOTES

⚠️ **Untuk Production:**
- ✅ Gunakan HTTPS (secure cookie)
- ✅ Hash password dengan bcrypt (bukan SHA256)
- ✅ Validasi input lebih ketat
- ✅ Rate limiting pada login
- ✅ CORS configuration
- ✅ Environment variables untuk config
- ✅ Audit logging untuk compliance

---

## 📚 TEKNOLOGI STACK

| Layer | Teknologi |
|-------|-----------|
| **Backend** | Node.js + Express.js |
| **Frontend** | HTML5 + Bootstrap 5 + Vanilla JS |
| **Database** | SQLite + better-sqlite3 |
| **API Hardware** | Web Bluetooth API (GATT) |
| **Session** | express-session |
| **Template** | EJS |

---

## 📄 FILE STRUCTURE

```
darsinurse-gateway/
├── server.js                 # Express app & routes
├── package.json              # Dependencies
├── darsinurse.db            # SQLite (auto-created)
├── views/
│   ├── login.ejs            # Login page
│   └── dashboard.ejs        # Main dashboard
└── public/
    ├── style.css            # Styling
    └── script.js            # Web Bluetooth logic
```

---

## 🚀 DEVELOPMENT MODE

Install nodemon untuk auto-restart:
```bash
npm install -D nodemon

# Update package.json scripts:
"dev": "nodemon server.js"

# Run:
npm run dev
```

---

## 📞 SUPPORT & DOKUMENTASI

**Web Bluetooth API:**
- https://www.bluetooth.com/specifications/gatt/

**Medical Device Standards (GATT):**
- https://www.bluetooth.com/specifications/assigned-numbers/health-device-service-uuids/

**Express.js:**
- https://expressjs.com/

**SQLite:**
- https://www.sqlite.org/docs.html

---

## 📜 LICENSE & CREDITS

**Darsinurse Gateway** v1.0.0  
Medical IoT Platform  
© 2025 Darsinurse Team  
Licensed under MIT

---

### ✨ SIAP DIGUNAKAN!

Jika ada pertanyaan atau bug, silakan cek console browser (F12) dan server logs.

**Happy monitoring!** 🏥💙