/* ============================================================
   DARSINURSE GATEWAY - Node.js + Express + MySQL
   Medical IoT Gateway using Web Bluetooth API
   © 2025 - Darsinurse System
   ============================================================ */

const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 4000;

/* ============================================================
   DATABASE CONNECTION (MySQL)
   ============================================================ */
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'darsinurse',
  waitForConnections: true,
  connectionLimit: 10
});

// Cek koneksi
pool.getConnection()
  .then(conn => {
    console.log('✓ MySQL Connected');
    conn.release();
  })
  .catch(err => {
    console.error('✗ MySQL Connection Failed:', err);
    process.exit(1);
  });

/* ============================================================
   AUTO DATABASE INIT
   ============================================================ */
async function initDatabase() {
  const conn = await pool.getConnection();
  
  // Tabel PERAWAT dengan role
  await conn.query(`
    CREATE TABLE IF NOT EXISTS perawat (
      id_perawat VARCHAR(10) PRIMARY KEY,
      nama VARCHAR(100),
      password VARCHAR(255),
      role ENUM('admin','perawat') DEFAULT 'perawat',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabel PASIEN
  await conn.query(`
    CREATE TABLE IF NOT EXISTS pasien (
      id_pasien VARCHAR(10) PRIMARY KEY,
      nama VARCHAR(100),
      alamat TEXT,
      tanggal_lahir DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Tabel PENGUKURAN
  await conn.query(`
    CREATE TABLE IF NOT EXISTS pengukuran (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_perawat VARCHAR(10),
      id_pasien VARCHAR(10),
      tipe_device VARCHAR(50),
      data VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_perawat) REFERENCES perawat(id_perawat),
      FOREIGN KEY (id_pasien) REFERENCES pasien(id_pasien)
    );
  `);

  // Dummy data perawat
  const [perawat] = await conn.query(`SELECT COUNT(*) AS c FROM perawat`);
  if (perawat[0].c === 0) {
    const hash = p => crypto.createHash('sha256').update(p).digest('hex');
    await conn.query(`
      INSERT INTO perawat (id_perawat, nama, password, role) VALUES
      ('ADMIN01','Administrator','${hash('admin123')}','admin'),
      ('P001','Siti Nurhaliza','${hash('pass123')}','perawat'),
      ('P002','Ahmad Wijaya','${hash('pass456')}','perawat'),
      ('P003','Dewi Lestari','${hash('pass789')}','perawat')
    `);
  }

  // Dummy data pasien
  const [pasien] = await conn.query(`SELECT COUNT(*) AS c FROM pasien`);
  if (pasien[0].c === 0) {
    await conn.query(`
      INSERT INTO pasien (id_pasien, nama, alamat, tanggal_lahir) VALUES
      ('PAT001','Budi Santoso','Jl. Merdeka No.10','1980-05-15'),
      ('PAT002','Susi Handini','Jl. Ahmad Yani No.25','1975-08-22'),
      ('PAT003','Rudi Hermawan','Jl. Pemuda No.30','1985-12-03'),
      ('PAT004','Ani Wijaya','Jl. Diponegoro No.15','1990-03-17')
    `);
  }

  conn.release();
  console.log("✓ Database initialized!");
}
initDatabase();

/* ============================================================
   EXPRESS & SESSION SETUP
   ============================================================ */
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'darsinurse-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false }
}));

/* ============================================================
   AUTH MIDDLEWARE
   ============================================================ */
const requireLogin = (req, res, next) => {
  if (!req.session.id_perawat) return res.redirect('/');
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session.id_perawat) return res.redirect('/');
  if (req.session.role !== 'admin') {
    return res.status(403).send('Access Denied: Admin only');
  }
  next();
};

/* ============================================================
   ROUTES
   ============================================================ */

// LOGIN PAGE
app.get('/', (req, res) => {
  if (req.session.id_perawat) {
    if (req.session.role === 'admin') {
      return res.redirect('/admin/manage-users');
    }
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

// PROSES LOGIN
app.post('/login', async (req, res) => {
  const { id_perawat, password } = req.body;
  const hash = crypto.createHash('sha256').update(password).digest('hex');

  const conn = await pool.getConnection();
  const [rows] = await conn.query(
    'SELECT * FROM perawat WHERE id_perawat = ?',
    [id_perawat]
  );
  conn.release();

  if (rows.length && rows[0].password === hash) {
    req.session.id_perawat = rows[0].id_perawat;
    req.session.nama_perawat = rows[0].nama;
    req.session.role = rows[0].role;
    
    // Redirect berdasarkan role
    if (rows[0].role === 'admin') {
      return res.redirect('/admin/manage-users');
    }
    return res.redirect('/dashboard');
  }

  return res.render('login', { error: 'ID Perawat atau Password salah!' });
});

// DASHBOARD (Hanya untuk perawat)
app.get('/dashboard', requireLogin, (req, res) => {
  if (req.session.role === 'admin') {
    return res.redirect('/admin/manage-users');
  }
  res.render('dashboard', {
    nama_perawat: req.session.nama_perawat,
    id_perawat: req.session.id_perawat
  });
});

// ========== ADMIN ROUTES ==========

// MANAGE USERS PAGE
app.get('/admin/manage-users', requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  const [users] = await conn.query(
    'SELECT id_perawat, nama, role, created_at FROM perawat ORDER BY created_at DESC'
  );
  conn.release();

  res.render('admin-users', {
    nama_perawat: req.session.nama_perawat,
    id_perawat: req.session.id_perawat,
    users: users
  });
});

// GET ALL USERS (API)
app.get('/admin/api/users', requireAdmin, async (req, res) => {
  const conn = await pool.getConnection();
  const [users] = await conn.query(
    'SELECT id_perawat, nama, role, created_at FROM perawat ORDER BY created_at DESC'
  );
  conn.release();
  res.json({ success: true, users });
});

// ADD NEW USER
app.post('/admin/api/users', requireAdmin, async (req, res) => {
  const { id_perawat, nama, password, role } = req.body;
  
  if (!id_perawat || !nama || !password || !role) {
    return res.status(400).json({ error: 'Semua field harus diisi' });
  }

  const hash = crypto.createHash('sha256').update(password).digest('hex');
  
  try {
    const conn = await pool.getConnection();
    await conn.query(
      'INSERT INTO perawat (id_perawat, nama, password, role) VALUES (?, ?, ?, ?)',
      [id_perawat, nama, hash, role]
    );
    conn.release();
    
    res.json({ success: true, message: 'User berhasil ditambahkan' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: 'ID Perawat sudah terdaftar' });
    } else {
      res.status(500).json({ error: 'Database error: ' + err.message });
    }
  }
});

// UPDATE USER
app.put('/admin/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nama, password, role } = req.body;
  
  if (!nama || !role) {
    return res.status(400).json({ error: 'Nama dan role harus diisi' });
  }

  try {
    const conn = await pool.getConnection();
    
    if (password && password.trim() !== '') {
      const hash = crypto.createHash('sha256').update(password).digest('hex');
      await conn.query(
        'UPDATE perawat SET nama = ?, password = ?, role = ? WHERE id_perawat = ?',
        [nama, hash, role, id]
      );
    } else {
      await conn.query(
        'UPDATE perawat SET nama = ?, role = ? WHERE id_perawat = ?',
        [nama, role, id]
      );
    }
    
    conn.release();
    res.json({ success: true, message: 'User berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// DELETE USER
app.delete('/admin/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Prevent deleting own account
  if (id === req.session.id_perawat) {
    return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri' });
  }

  try {
    const conn = await pool.getConnection();
    await conn.query('DELETE FROM perawat WHERE id_perawat = ?', [id]);
    conn.release();
    
    res.json({ success: true, message: 'User berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// ========== PERAWAT ROUTES ==========

// SIMPAN DATA PENGUKURAN
app.post('/simpan_data', requireLogin, async (req, res) => {
  const { id_pasien, tipe_device, data } = req.body;
  if (!id_pasien || !tipe_device || !data)
    return res.status(400).json({ error: 'Data tidak lengkap' });

  const conn = await pool.getConnection();
  const [result] = await conn.query(
    `INSERT INTO pengukuran (id_perawat, id_pasien, tipe_device, data)
     VALUES (?, ?, ?, ?)`,
    [req.session.id_perawat, id_pasien, tipe_device, data]
  );
  conn.release();

  res.json({
    success: true,
    id: result.insertId,
    message: "Data berhasil disimpan"
  });
});

// RIWAYAT PENGUKURAN PASIEN
app.get('/riwayat/:id', requireLogin, async (req, res) => {
  const conn = await pool.getConnection();
  const [rows] = await conn.query(
    `SELECT tipe_device, data, timestamp 
     FROM pengukuran 
     WHERE id_pasien = ?
     ORDER BY timestamp DESC LIMIT 50`,
    [req.params.id]
  );
  conn.release();

  res.json({ success: true, data: rows });
});

// VALIDASI PASIEN
app.get('/validasi_pasien/:id', requireLogin, async (req, res) => {
  const conn = await pool.getConnection();
  const [rows] = await conn.query(
    'SELECT * FROM pasien WHERE id_pasien = ?',
    [req.params.id]
  );
  conn.release();

  res.json({ valid: rows.length > 0, pasien: rows[0] || null });
});

// LOGOUT
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

/* ============================================================
   START HTTP SERVER
   ============================================================ */
http.createServer(app).listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║      DARSINURSE GATEWAY - MySQL        ║
║   Server running on http://localhost:${PORT}  ║
╚════════════════════════════════════════╝
`);
});