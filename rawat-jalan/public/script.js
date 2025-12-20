// ============================================
// DARSINURSE GATEWAY - Frontend Script
// Web Bluetooth API Implementation
// ============================================

// ==== UUID STANDAR GATT ====
const BLOOD_PRESSURE_SERVICE = 0x1810;
const HEART_RATE_SERVICE = 0x180D;
const WEIGHT_SCALE_SERVICE = 0x181D;
const GLUCOSE_SERVICE = 0x1808;

const BP_MEASUREMENT_CHAR = 0x2A35;
const HR_MEASUREMENT_CHAR = 0x2A37;
const WEIGHT_MEASUREMENT_CHAR = 0x2A9D;
const GLUCOSE_MEASUREMENT_CHAR = 0x2A18;
const RACP_CHAR = 0x2A52; // Record Access Control Point

// ==== DOM ELEMENTS ====
const statusText = document.getElementById('ble-status');
const btnScan = document.getElementById('btn-scan-ble');
const btnValidate = document.getElementById('btn-validate');
const idPasienInput = document.getElementById('id_pasien');
const patientInfo = document.getElementById('patient-info');
const activityLog = document.getElementById('activity-log');

// ===== MEASUREMENT FIELDS =====
const measurementFields = {
  glucose: {
    value: document.getElementById('glucose-value'),
    source: document.getElementById('glucose-source'),
    unit: 'mg/dL'
  },
  bp: {
    value: document.getElementById('bp-value'),
    source: document.getElementById('bp-source'),
    unit: 'mmHg'
  },
  hr: {
    value: document.getElementById('hr-value'),
    source: document.getElementById('hr-source'),
    unit: 'bpm'
  },
  weight: {
    value: document.getElementById('weight-value'),
    source: document.getElementById('weight-source'),
    unit: 'kg'
  }
};

// ==== STATE ====
let currentIdPasien = null;
let connectedDevice = null;

// ==== LOGGING FUNCTION ====
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('id-ID');
  const logClass = type === 'success' ? 'log-success' : type === 'error' ? 'log-error' : '';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : '→';
  
  const logEntry = document.createElement('div');
  logEntry.innerHTML = `<span class="log-time">[${timestamp}]</span> <span class="${logClass}">${icon} ${message}</span>`;
  
  activityLog.insertBefore(logEntry, activityLog.firstChild);
  
  // Keep only last 20 entries
  while (activityLog.children.length > 20) {
    activityLog.removeChild(activityLog.lastChild);
  }
}

// ==== VALIDATE PATIENT ====
btnValidate.addEventListener('click', async () => {
  const idPasien = idPasienInput.value.trim();
  
  if (!idPasien) {
    alert('Masukkan ID Pasien terlebih dahulu');
    return;
  }

  try {
    const response = await fetch(`/validasi_pasien/${idPasien}`);
    const result = await response.json();

    if (result.valid) {
      currentIdPasien = idPasien;
      patientInfo.innerHTML = `✓ <strong>${result.pasien.nama}</strong> (${result.pasien.alamat})`;
      patientInfo.style.color = '#28a745';
      btnScan.disabled = false;
      addLog(`Pasien ditemukan: ${result.pasien.nama}`, 'success');
    } else {
      patientInfo.innerHTML = '✗ Pasien tidak ditemukan';
      patientInfo.style.color = '#dc3545';
      currentIdPasien = null;
      btnScan.disabled = true;
      addLog('Pasien tidak ditemukan', 'error');
    }
  } catch (err) {
    patientInfo.innerHTML = '✗ Error: ' + err.message;
    patientInfo.style.color = '#dc3545';
    addLog('Error validasi: ' + err.message, 'error');
  }
});

// ==== SEND DATA TO SERVER ====
async function sendToServer(tipe, dataValue) {
  if (!currentIdPasien) {
    addLog('ID Pasien belum valid', 'error');
    return;
  }

  const idPerawat = sessionStorage.getItem('id_perawat');

  try {
    const response = await fetch('/simpan_data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id_perawat: idPerawat,
        id_pasien: currentIdPasien,
        tipe_device: tipe,
        data: dataValue
      })
    });

    const result = await response.json();
    
    if (result.success) {
      addLog(`${tipe} disimpan: ${dataValue}`, 'success');
    } else {
      addLog(`Error menyimpan: ${result.error}`, 'error');
    }
  } catch (err) {
    addLog(`Network error: ${err.message}`, 'error');
  }
}

// ==== HELPER: PARSE SFLOAT (untuk Glukosa) ====
function parseSFLOAT(bytes) {
  // SFLOAT format: mantissa (3 bytes) + exponent (1 byte)
  if (bytes.length < 2) return null;
  
  const mantissa = bytes[0] | (bytes[1] << 8) | ((bytes[2] & 0x0F) << 16);
  const exponent = ((bytes[2] & 0xF0) >> 4);
  
  // Handle special exponent values
  if (exponent === 0xF) return null; // Reserved
  
  const exp = exponent > 7 ? exponent - 16 : exponent;
  return mantissa * Math.pow(10, exp);
}

// ==== HANDLER: GLUKOSA ====
async function handleGlucose(event, service) {
  try {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer);

    // Glukosa measurement format (SFLOAT di offset 1-3)
    // Byte 0: flags
    // Byte 1-3: glukosa value (SFLOAT)
    let glucoseValue = null;

    if (bytes.length >= 4) {
      const glucoseBytes = [bytes[1], bytes[2], bytes[3]];
      glucoseValue = parseSFLOAT(glucoseBytes);
    }

    if (glucoseValue !== null) {
      // Round to 1 decimal
      glucoseValue = Math.round(glucoseValue * 10) / 10;
      
      measurementFields.glucose.value.textContent = glucoseValue.toFixed(0);
      measurementFields.glucose.source.style.display = 'inline-block';
      
      addLog(`Glukosa: ${glucoseValue} mg/dL`, 'success');
      highlightField(measurementFields.glucose.value);
      
      await sendToServer('glukosa', glucoseValue.toString());
    }
  } catch (err) {
    addLog(`Error parsing glukosa: ${err.message}`, 'error');
  }
}

// ==== HANDLER: BLOOD PRESSURE (TENSI) ====
function handleBP(event) {
  try {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer);

    // BP Measurement format:
    // Byte 0: flags
    // Byte 1-2: systolic (uint16, little endian)
    // Byte 3-4: diastolic (uint16, little endian)
    // Byte 5-6: MAP (mean arterial pressure)

    if (bytes.length >= 5) {
      const systolic = bytes[1] | (bytes[2] << 8);
      const diastolic = bytes[3] | (bytes[4] << 8);

      const bpValue = `${systolic}/${diastolic}`;
      measurementFields.bp.value.textContent = bpValue;
      measurementFields.bp.source.style.display = 'inline-block';

      addLog(`Tensi: ${bpValue} mmHg`, 'success');
      highlightField(measurementFields.bp.value);

      sendToServer('tensimeter', bpValue);
    }
  } catch (err) {
    addLog(`Error parsing tensi: ${err.message}`, 'error');
  }
}

// ==== HANDLER: HEART RATE ====
function handleHR(event) {
  try {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer);

    // HR Measurement format:
    // Byte 0: flags (bit 0 = value format)
    // Byte 1+: HR value (uint8 atau uint16)

    let hrValue = null;
    const flags = bytes[0];

    if ((flags & 0x01) === 0) {
      // uint8 format
      hrValue = bytes[1];
    } else {
      // uint16 format (little endian)
      hrValue = bytes[1] | (bytes[2] << 8);
    }

    if (hrValue !== null) {
      measurementFields.hr.value.textContent = hrValue;
      measurementFields.hr.source.style.display = 'inline-block';

      addLog(`Heart Rate: ${hrValue} bpm`, 'success');
      highlightField(measurementFields.hr.value);

      sendToServer('heart_rate', hrValue.toString());
    }
  } catch (err) {
    addLog(`Error parsing heart rate: ${err.message}`, 'error');
  }
}

// ==== HANDLER: WEIGHT SCALE ====
function handleWeight(event) {
  try {
    const value = event.target.value;
    const bytes = new Uint8Array(value.buffer);

    // Weight Measurement format:
    // Byte 0: flags (bit 0 = imperial/metric)
    // Byte 1-2: weight value (uint16, little endian, divided by 200 for metric)

    if (bytes.length >= 3) {
      const flags = bytes[0];
      const weightRaw = bytes[1] | (bytes[2] << 8);
      
      // Metric: divide by 200, Imperial: divide by 100
      const divisor = (flags & 0x01) ? 100 : 200;
      const weightValue = weightRaw / divisor;

      const displayWeight = Math.round(weightValue * 10) / 10;
      measurementFields.weight.value.textContent = displayWeight.toFixed(1);
      measurementFields.weight.source.style.display = 'inline-block';

      addLog(`Berat Badan: ${displayWeight} kg`, 'success');
      highlightField(measurementFields.weight.value);

      sendToServer('timbangan', displayWeight.toString());
    }
  } catch (err) {
    addLog(`Error parsing weight: ${err.message}`, 'error');
  }
}

// ==== HIGHLIGHT FIELD ====
function highlightField(element) {
  element.style.color = '#20c997';
  element.style.textShadow = '0 0 10px rgba(32, 201, 151, 0.5)';
  
  setTimeout(() => {
    element.style.color = '';
    element.style.textShadow = '';
  }, 1500);
}

// ==== MAIN BLE SCAN FUNCTION ====
btnScan.addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    alert('Browser Anda tidak mendukung Web Bluetooth API!\nGunakan Chrome, Edge, atau Opera di desktop/Android.');
    return;
  }

  if (!currentIdPasien) {
    alert('Validasi pasien terlebih dahulu');
    return;
  }

  try {
    statusText.textContent = '🔍 Mencari perangkat BLE...';
    statusText.className = 'alert alert-info';
    btnScan.disabled = true;
    addLog('Mulai scanning perangkat BLE...', 'info');

    // Request device dengan multiple filters
    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [BLOOD_PRESSURE_SERVICE] },
        { services: [HEART_RATE_SERVICE] },
        { services: [WEIGHT_SCALE_SERVICE] },
        { services: [GLUCOSE_SERVICE] }
      ],
      optionalServices: [
        BLOOD_PRESSURE_SERVICE,
        HEART_RATE_SERVICE,
        WEIGHT_SCALE_SERVICE,
        GLUCOSE_SERVICE
      ]
    });

    connectedDevice = device;
    statusText.textContent = `✓ Terhubung ke: ${device.name || 'Perangkat'}`;
    statusText.className = 'alert alert-success';
    addLog(`Perangkat ditemukan: ${device.name}`, 'success');

    const server = await device.gatt.connect();
    statusText.textContent = `✓ GATT Server terhubung`;
    addLog('GATT Server connected', 'success');

    // 1. COBA GLUKOSA (prioritas)
    try {
      const glucoseSvc = await server.getPrimaryService(GLUCOSE_SERVICE);
      const glucoseChar = await glucoseSvc.getCharacteristic(GLUCOSE_MEASUREMENT_CHAR);
      await glucoseChar.startNotifications();
      glucoseChar.addEventListener('characteristicvaluechanged', (e) => handleGlucose(e, glucoseSvc));
      
      statusText.textContent = '✓ Glukosa meter siap - lakukan tes atau minta riwayat';
      statusText.className = 'alert alert-success';
      addLog('Glukosa meter berhasil dikalibrasi', 'success');
      return; // Stop kalau sudah ketemu glukosa
    } catch (e) {
      console.log('[INFO] Bukan glucose meter:', e.message);
    }

    // 2. COBA BLOOD PRESSURE
    try {
      const bpSvc = await server.getPrimaryService(BLOOD_PRESSURE_SERVICE);
      const bpChar = await bpSvc.getCharacteristic(BP_MEASUREMENT_CHAR);
      await bpChar.startNotifications();
      bpChar.addEventListener('characteristicvaluechanged', handleBP);
      
      statusText.textContent = '✓ Tensimeter siap - lakukan pengukuran';
      statusText.className = 'alert alert-success';
      addLog('Tensimeter berhasil dikalibrasi', 'success');
    } catch (e) {
      console.log('[INFO] Tensimeter tidak ditemukan:', e.message);
    }

    // 3. COBA HEART RATE
    try {
      const hrSvc = await server.getPrimaryService(HEART_RATE_SERVICE);
      const hrChar = await hrSvc.getCharacteristic(HR_MEASUREMENT_CHAR);
      await hrChar.startNotifications();
      hrChar.addEventListener('characteristicvaluechanged', handleHR);
      
      statusText.textContent = '✓ Heart Rate sensor siap';
      statusText.className = 'alert alert-success';
      addLog('Heart Rate sensor berhasil dikalibrasi', 'success');
    } catch (e) {
      console.log('[INFO] Heart Rate sensor tidak ditemukan:', e.message);
    }

    // 4. COBA WEIGHT SCALE
    try {
      const weightSvc = await server.getPrimaryService(WEIGHT_SCALE_SERVICE);
      const weightChar = await weightSvc.getCharacteristic(WEIGHT_MEASUREMENT_CHAR);
      await weightChar.startNotifications();
      weightChar.addEventListener('characteristicvaluechanged', handleWeight);
      
      statusText.textContent = '✓ Timbangan siap - naik ke atas dan tunggu hasil';
      statusText.className = 'alert alert-success';
      addLog('Timbangan berhasil dikalibrasi', 'success');
    } catch (e) {
      console.log('[INFO] Timbangan tidak ditemukan:', e.message);
    }

    // Re-enable button setelah 30 detik
    setTimeout(() => {
      btnScan.disabled = false;
    }, 30000);

  } catch (err) {
    if (err.name === 'NotFoundError') {
      statusText.textContent = '✗ Perangkat tidak ditemukan. Pastikan sudah dihidupkan dan dalam jangkauan';
      addLog('User membatalkan atau tidak ada device ditemukan', 'error');
    } else {
      statusText.textContent = `✗ Error: ${err.message}`;
      addLog(`Scan error: ${err.message}`, 'error');
    }
    statusText.className = 'alert alert-danger';
    btnScan.disabled = false;
  }
});

// ==== INITIALIZATION ====
document.addEventListener('DOMContentLoaded', () => {
  addLog('Dashboard berhasil dimuat', 'success');
  addLog('Masukkan ID Pasien dan validasi untuk memulai', 'info');
  
  // Check Browser Support
  if (!navigator.bluetooth) {
    statusText.textContent = '⚠ Browser tidak mendukung Web Bluetooth API';
    statusText.className = 'alert alert-warning';
    btnScan.disabled = true;
  }
});