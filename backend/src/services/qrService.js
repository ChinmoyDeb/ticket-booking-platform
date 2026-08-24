const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const QR_DIR = path.join(__dirname, '../../qr-codes');
const SECRET = process.env.QR_CODE_SECRET || 'qr-default-secret';

// Ensure QR storage directory exists
if (!fs.existsSync(QR_DIR)) {
  fs.mkdirSync(QR_DIR, { recursive: true });
}

/**
 * Generate an HMAC checksum for QR data to prevent tampering.
 */
function generateChecksum(payload) {
  return crypto.createHmac('sha256', SECRET).update(JSON.stringify(payload)).digest('hex');
}

/**
 * Generate a QR code PNG for a booking.
 * The QR encodes a JSON payload with an HMAC checksum.
 *
 * @returns {Promise<{filePath: string, qrDataUrl: string}>}
 */
async function generateQR(bookingReference, bookingId, customerId, eventId) {
  const payload = { bookingReference, bookingId, customerId, eventId, timestamp: Date.now() };
  const checksum = generateChecksum(payload);
  const qrData = JSON.stringify({ ...payload, checksum });

  const fileName = `${bookingReference}-${Date.now()}.png`;
  const filePath = path.join(QR_DIR, fileName);

  // Generate QR as a data URL (for embedding in emails)
  const qrDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });

  // Also save to disk (for email attachments / re-use)
  await QRCode.toFile(filePath, qrData, {
    errorCorrectionLevel: 'H',
    width: 300,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  });

  return { filePath, qrDataUrl, fileName };
}

/**
 * Verify QR code data from a scanner.
 * Validates HMAC checksum and returns booking reference.
 */
function verifyQR(qrData) {
  try {
    const parsed = JSON.parse(qrData);
    const { checksum, ...payload } = parsed;
    const expectedChecksum = generateChecksum(payload);
    if (checksum !== expectedChecksum) {
      return { valid: false, error: 'Invalid QR code (checksum mismatch)' };
    }
    return { valid: true, bookingReference: payload.bookingReference, bookingId: payload.bookingId };
  } catch {
    return { valid: false, error: 'Invalid QR code format' };
  }
}

/**
 * Clean up QR codes older than 90 days.
 */
function cleanupOldQRCodes() {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  try {
    const files = fs.readdirSync(QR_DIR);
    for (const file of files) {
      const filePath = path.join(QR_DIR, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('[QR] Cleanup error:', err.message);
  }
}

module.exports = { generateQR, verifyQR, cleanupOldQRCodes };
