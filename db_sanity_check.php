<?php
/**
 * Database Sanity Check - DARSINURSE
 * Validates table structure, columns, and data integrity
 * 
 * Usage: php db_sanity_check.php
 */

// Load environment variables
$env_file = __DIR__ . '/.env';
if (!file_exists($env_file)) {
    $env_file = __DIR__ . '/.env.example';
}

$env = parse_ini_file($env_file);

// Database connection
$host = $env['DB_HOST'] ?? 'localhost';
$user = $env['DB_USER'] ?? 'root';
$password = $env['DB_PASSWORD'] ?? '';
$database = $env['DB_NAME'] ?? 'darsinurse';

$mysqli = new mysqli($host, $user, $password, $database);

if ($mysqli->connect_error) {
    die("❌ Connection failed: " . $mysqli->connect_error . "\n");
}

echo "✓ Connected to database: $database\n\n";

class DatabaseSanityCheck {
    private $mysqli;
    private $database;
    private $errors = [];
    private $warnings = [];
    private $pass_count = 0;
    private $total_checks = 0;

    public function __construct($mysqli, $database) {
        $this->mysqli = $mysqli;
        $this->database = $database;
    }

    public function runAllChecks() {
        echo "════════════════════════════════════════════════════════\n";
        echo "  DATABASE SANITY CHECK - DARSINURSE\n";
        echo "════════════════════════════════════════════════════════\n\n";

        $this->checkTableExistence();
        $this->checkTableColumns();
        $this->checkDataTypes();
        $this->checkForeignKeys();
        $this->checkIndexes();
        $this->checkDataIntegrity();
        $this->checkRequiredMigrations();

        $this->printSummary();
    }

    // ============================================================
    // 1. CHECK TABLE EXISTENCE
    // ============================================================
    private function checkTableExistence() {
        echo "📊 1. CHECKING TABLE EXISTENCE\n";
        echo "─────────────────────────────────────────────────────\n";

        $required_tables = [
            'perawat',
            'pasien',
            'kunjungan',
            'vitals',
            'pelayanan_rsi',
            'room_device'
        ];

        foreach ($required_tables as $table) {
            $this->total_checks++;
            $result = $this->mysqli->query(
                "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = '$table'"
            );
            $row = $result->fetch_array();

            if ($row[0] > 0) {
                echo "  ✓ Table '$table' exists\n";
                $this->pass_count++;
            } else {
                echo "  ✗ Table '$table' MISSING\n";
                $this->errors[] = "Table '$table' not found";
            }
        }
        echo "\n";
    }

    // ============================================================
    // 2. CHECK TABLE COLUMNS
    // ============================================================
    private function checkTableColumns() {
        echo "🔍 2. CHECKING TABLE COLUMNS\n";
        echo "─────────────────────────────────────────────────────\n";

        $expected_columns = [
            'perawat' => ['emr_perawat', 'nama', 'password', 'role', 'created_at'],
            'pasien' => ['emr_no', 'nama', 'tanggal_lahir', 'jenis_kelamin', 'poli', 'alamat', 'created_at'],
            'kunjungan' => ['id_kunjungan', 'emr_no', 'emr_perawat', 'emr_dokter', 'tanggal_kunjungan', 'keluhan', 'status'],
            'vitals' => [
                'id', 'emr_no', 'id_kunjungan', 'pelayanan_id', 'emr_perawat', 'waktu',
                'heart_rate', 'sistolik', 'diastolik', 'respirasi', 'glukosa',
                'berat_badan_kg', 'tinggi_badan_cm', 'bmi', 'jarak_kasur_cm', 'fall_detected',
                'suhu', 'spo2', 'asam_urat', 'kolesterol'
            ],
            'pelayanan_rsi' => ['id', 'pelayanan_id', 'emr_no', 'nama_pasien', 'tanggal_pelayanan', 'unit', 'created_at', 'updated_at'],
            'room_device' => ['id', 'emr_no', 'room_id', 'device_id', 'assigned_at']
        ];

        foreach ($expected_columns as $table => $columns) {
            foreach ($columns as $col) {
                $this->total_checks++;
                $result = $this->mysqli->query(
                    "SELECT COLUMN_NAME FROM information_schema.COLUMNS 
                     WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = '$table' AND COLUMN_NAME = '$col'"
                );

                if ($result->num_rows > 0) {
                    echo "  ✓ $table.$col\n";
                    $this->pass_count++;
                } else {
                    echo "  ✗ $table.$col MISSING\n";
                    $this->errors[] = "Column '$col' not found in table '$table'";
                }
            }
        }
        echo "\n";
    }

    // ============================================================
    // 3. CHECK DATA TYPES
    // ============================================================
    private function checkDataTypes() {
        echo "📐 3. CHECKING DATA TYPES\n";
        echo "─────────────────────────────────────────────────────\n";

        $expected_types = [
            'perawat' => [
                'emr_perawat' => 'int',
                'password' => 'varchar',
                'role' => 'enum'
            ],
            'pasien' => [
                'emr_no' => 'varchar',
                'tanggal_lahir' => 'date',
                'jenis_kelamin' => 'enum'
            ],
            'vitals' => [
                'id' => 'int',
                'emr_no' => 'varchar',
                'heart_rate' => 'int',
                'berat_badan_kg' => 'decimal',
                'tinggi_badan_cm' => 'int',
                'bmi' => 'decimal',
                'suhu' => 'decimal',
                'spo2' => 'int',
                'asam_urat' => 'decimal',
                'kolesterol' => 'int'
            ],
            'pelayanan_rsi' => [
                'pelayanan_id' => 'int',
                'tanggal_pelayanan' => 'date'
            ]
        ];

        foreach ($expected_types as $table => $columns) {
            foreach ($columns as $col => $expected_type) {
                $this->total_checks++;
                $result = $this->mysqli->query(
                    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
                     WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = '$table' AND COLUMN_NAME = '$col'"
                );

                if ($result->num_rows > 0) {
                    $row = $result->fetch_array();
                    $actual_type = strtolower($row[0]);

                    // Check if type matches
                    $type_match = strpos($actual_type, $expected_type) !== false;

                    if ($type_match) {
                        echo "  ✓ $table.$col = $actual_type\n";
                        $this->pass_count++;
                    } else {
                        echo "  ⚠ $table.$col = $actual_type (expected $expected_type)\n";
                        $this->warnings[] = "$table.$col has type '$actual_type', expected '$expected_type'";
                    }
                }
            }
        }
        echo "\n";
    }

    // ============================================================
    // 4. CHECK FOREIGN KEYS
    // ============================================================
    private function checkForeignKeys() {
        echo "🔗 4. CHECKING FOREIGN KEYS\n";
        echo "─────────────────────────────────────────────────────\n";

        $expected_fks = [
            'kunjungan' => [
                'emr_no' => 'pasien(emr_no)',
                'emr_perawat' => 'perawat(emr_perawat)'
            ],
            'vitals' => [
                'emr_no' => 'pasien(emr_no)',
                'id_kunjungan' => 'kunjungan(id_kunjungan)',
                'emr_perawat' => 'perawat(emr_perawat)'
            ],
            'pelayanan_rsi' => [
                'emr_no' => 'pasien(emr_no)'
            ],
            'room_device' => [
                'emr_no' => 'pasien(emr_no)'
            ]
        ];

        foreach ($expected_fks as $table => $constraints) {
            foreach ($constraints as $column => $reference) {
                $this->total_checks++;
                $result = $this->mysqli->query(
                    "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
                     WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = '$table' 
                     AND COLUMN_NAME = '$column' AND REFERENCED_TABLE_NAME IS NOT NULL"
                );

                if ($result->num_rows > 0) {
                    echo "  ✓ $table.$column → $reference\n";
                    $this->pass_count++;
                } else {
                    echo "  ✗ $table.$column → $reference MISSING\n";
                    $this->warnings[] = "Foreign key not found: $table.$column → $reference";
                }
            }
        }
        echo "\n";
    }

    // ============================================================
    // 5. CHECK INDEXES
    // ============================================================
    private function checkIndexes() {
        echo "⚡ 5. CHECKING INDEXES\n";
        echo "─────────────────────────────────────────────────────\n";

        $expected_indexes = [
            'kunjungan' => ['idx_kunjungan_emr_perawat', 'idx_kunjungan_status'],
            'vitals' => ['idx_emr_waktu', 'idx_kunjungan', 'idx_fall', 'idx_vitals_waktu'],
            'pelayanan_rsi' => ['idx_pelayanan_id', 'idx_emr_no', 'idx_tanggal'],
        ];

        foreach ($expected_indexes as $table => $indexes) {
            foreach ($indexes as $index) {
                $this->total_checks++;
                $result = $this->mysqli->query(
                    "SELECT INDEX_NAME FROM information_schema.STATISTICS 
                     WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = '$table' 
                     AND INDEX_NAME = '$index'"
                );

                if ($result->num_rows > 0) {
                    echo "  ✓ $table.$index\n";
                    $this->pass_count++;
                } else {
                    echo "  ⚠ $table.$index NOT FOUND\n";
                    $this->warnings[] = "Index not found: $table.$index";
                }
            }
        }
        echo "\n";
    }

    // ============================================================
    // 6. CHECK DATA INTEGRITY
    // ============================================================
    private function checkDataIntegrity() {
        echo "🔎 6. CHECKING DATA INTEGRITY\n";
        echo "─────────────────────────────────────────────────────\n";

        // Check orphaned records in kunjungan
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COUNT(*) FROM kunjungan k 
             WHERE k.emr_no NOT IN (SELECT emr_no FROM pasien)"
        );
        $row = $result->fetch_array();
        if ($row[0] == 0) {
            echo "  ✓ No orphaned kunjungan records\n";
            $this->pass_count++;
        } else {
            echo "  ✗ Found $row[0] orphaned records in kunjungan\n";
            $this->warnings[] = "Found $row[0] orphaned records in kunjungan (invalid emr_no)";
        }

        // Check orphaned records in vitals
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COUNT(*) FROM vitals v 
             WHERE v.emr_no NOT IN (SELECT emr_no FROM pasien)"
        );
        $row = $result->fetch_array();
        if ($row[0] == 0) {
            echo "  ✓ No orphaned vitals records\n";
            $this->pass_count++;
        } else {
            echo "  ✗ Found $row[0] orphaned records in vitals\n";
            $this->warnings[] = "Found $row[0] orphaned records in vitals (invalid emr_no)";
        }

        // Check NULL values in critical fields
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COUNT(*) FROM pasien WHERE emr_no IS NULL OR nama IS NULL"
        );
        $row = $result->fetch_array();
        if ($row[0] == 0) {
            echo "  ✓ No NULL values in critical pasien fields\n";
            $this->pass_count++;
        } else {
            echo "  ✗ Found $row[0] pasien records with NULL critical fields\n";
            $this->warnings[] = "Found pasien records with NULL critical fields";
        }

        // Check duplicate EMR in pasien
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT emr_no, COUNT(*) as cnt FROM pasien GROUP BY emr_no HAVING cnt > 1"
        );
        if ($result->num_rows == 0) {
            echo "  ✓ No duplicate EMR numbers\n";
            $this->pass_count++;
        } else {
            echo "  ✗ Found duplicate EMR numbers\n";
            $this->warnings[] = "Found duplicate EMR records in pasien";
        }

        // Check vitals with invalid BMI values
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COUNT(*) FROM vitals 
             WHERE bmi IS NOT NULL AND (bmi < 10 OR bmi > 60)"
        );
        $row = $result->fetch_array();
        if ($row[0] == 0) {
            echo "  ✓ BMI values in reasonable range\n";
            $this->pass_count++;
        } else {
            echo "  ⚠ Found $row[0] vitals with unusual BMI values\n";
            $this->warnings[] = "Found $row[0] vitals records with unusual BMI values (< 10 or > 60)";
        }

        // Check vitals with invalid heart rate
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COUNT(*) FROM vitals 
             WHERE heart_rate IS NOT NULL AND (heart_rate < 30 OR heart_rate > 200)"
        );
        $row = $result->fetch_array();
        if ($row[0] == 0) {
            echo "  ✓ Heart rate values in reasonable range\n";
            $this->pass_count++;
        } else {
            echo "  ⚠ Found $row[0] vitals with unusual heart rate values\n";
            $this->warnings[] = "Found $row[0] vitals records with unusual heart rate values (< 30 or > 200)";
        }

        echo "\n";
    }

    // ============================================================
    // 7. CHECK REQUIRED MIGRATIONS
    // ============================================================
    private function checkRequiredMigrations() {
        echo "🔄 7. CHECKING REQUIRED MIGRATIONS\n";
        echo "─────────────────────────────────────────────────────\n";

        // Check emr_dokter column in kunjungan
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = 'kunjungan' 
             AND COLUMN_NAME = 'emr_dokter'"
        );
        if ($result->num_rows > 0) {
            echo "  ✓ kunjungan.emr_dokter column exists\n";
            $this->pass_count++;
        } else {
            echo "  ✗ kunjungan.emr_dokter column MISSING (needs migration)\n";
            $this->errors[] = "Migration missing: emr_dokter column in kunjungan";
        }

        // Check pelayanan_rsi table
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT TABLE_NAME FROM information_schema.TABLES 
             WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = 'pelayanan_rsi'"
        );
        if ($result->num_rows > 0) {
            echo "  ✓ pelayanan_rsi table exists\n";
            $this->pass_count++;
        } else {
            echo "  ✗ pelayanan_rsi table MISSING (needs migration)\n";
            $this->errors[] = "Migration missing: pelayanan_rsi table";
        }

        // Check vitals table data types (should be migrated)
        $this->total_checks++;
        $result = $this->mysqli->query(
            "SELECT COLUMN_TYPE FROM information_schema.COLUMNS 
             WHERE TABLE_SCHEMA = '$this->database' AND TABLE_NAME = 'vitals' 
             AND COLUMN_NAME = 'bmi'"
        );
        if ($result->num_rows > 0) {
            $row = $result->fetch_array();
            if (strpos(strtolower($row[0]), 'decimal(4,1)') !== false) {
                echo "  ✓ vitals.bmi data type is correct (DECIMAL(4,1))\n";
                $this->pass_count++;
            } else {
                echo "  ⚠ vitals.bmi data type is " . $row[0] . " (should be DECIMAL(4,1))\n";
                $this->warnings[] = "vitals.bmi should be DECIMAL(4,1) for precision";
            }
        }

        echo "\n";
    }

    // ============================================================
    // PRINT SUMMARY
    // ============================================================
    private function printSummary() {
        echo "════════════════════════════════════════════════════════\n";
        echo "  SUMMARY\n";
        echo "════════════════════════════════════════════════════════\n\n";

        $percentage = ($this->pass_count / $this->total_checks) * 100;
        $status = $percentage === 100 ? '✓ PASS' : ($percentage >= 80 ? '⚠ CAUTION' : '✗ FAIL');

        printf("  %s\n", $status);
        printf("  Checks Passed: %d/%d (%.1f%%)\n\n", $this->pass_count, $this->total_checks, $percentage);

        if (!empty($this->errors)) {
            echo "  ❌ CRITICAL ERRORS:\n";
            foreach ($this->errors as $error) {
                echo "     • $error\n";
            }
            echo "\n";
        }

        if (!empty($this->warnings)) {
            echo "  ⚠️  WARNINGS:\n";
            foreach ($this->warnings as $warning) {
                echo "     • $warning\n";
            }
            echo "\n";
        }

        if (empty($this->errors) && empty($this->warnings)) {
            echo "  🎉 All checks passed! Database structure is valid.\n";
        }

        echo "\n";
    }
}

// Run checks
$check = new DatabaseSanityCheck($mysqli, $database);
$check->runAllChecks();

$mysqli->close();
?>
