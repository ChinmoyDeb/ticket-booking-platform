const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Create reusable transporter
const transporterConfig = process.env.SMTP_HOST ? {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
} : {
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  }
};

const transporter = nodemailer.createTransport({
  ...transporterConfig,
  pool: true,
  maxConnections: 5,
  rateLimit: 10,
});

const FROM_ADDRESS = `"${process.env.EMAIL_FROM_NAME || 'TicketHub'}" <${process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_USER || process.env.GMAIL_USER}>`;

/**
 * Load and render an HTML email template.
 * Replaces {{variable}} placeholders with values.
 */
function renderTemplate(templateName, variables) {
  const templatePath = path.join(__dirname, '../templates', `${templateName}.html`);
  let html = fs.readFileSync(templatePath, 'utf8');
  for (const [key, value] of Object.entries(variables)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value ?? '');
  }
  return html;
}

/**
 * Send an email with retry logic.
 */
async function sendEmail(to, subject, html, attachments = [], retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail({ from: FROM_ADDRESS, to, subject, html, attachments });
      console.log(`[Email] Sent to ${to} | Subject: "${subject}" | MsgId: ${info.messageId}`);
      return info;
    } catch (err) {
      console.error(`[Email] Attempt ${attempt}/${retries} failed for ${to}: ${err.message}`);
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}

/**
 * Send booking confirmation email with embedded QR code.
 */
async function sendBookingConfirmation(user, booking, event, seats, qrDataUrl, qrFilePath) {
  const seatList = seats.map((s) => `Row ${s.rowNumber}, Seat ${s.seatNumber} (${s.categoryName})`).join('<br>');
  const html = renderTemplate('booking-confirmation', {
    customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    bookingReference: booking.bookingReference,
    eventTitle: event.title,
    eventDate: new Date(event.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    eventTime: event.eventTime,
    venueName: event.venueName,
    venueCity: event.venueCity,
    seatList,
    totalAmount: `₹${parseFloat(booking.totalAmount).toFixed(2)}`,
    qrCodeCid: 'qrcode@tickethub',
  });

  const attachments = qrFilePath
    ? [{ filename: 'ticket-qr.png', path: qrFilePath, cid: 'qrcode@tickethub' }]
    : [];

  await sendEmail(user.email, `🎫 Booking Confirmed — ${booking.bookingReference}`, html, attachments);
}

/**
 * Send waitlist offer email with time-limited accept link.
 */
async function sendWaitlistOffer(user, event, waitlistEntry, offerToken) {
  const ttlMinutes = parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES) || 15;
  const acceptUrl = `${process.env.FRONTEND_URL}/waitlist/accept?token=${offerToken}`;
  const declineUrl = `${process.env.FRONTEND_URL}/waitlist/decline?token=${offerToken}`;

  const html = renderTemplate('waitlist-offer', {
    customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    eventTitle: event.title,
    eventDate: new Date(event.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    eventTime: event.eventTime,
    venueName: event.venueName,
    categoryName: waitlistEntry.categoryName,
    ttlMinutes,
    acceptUrl,
    declineUrl,
  });

  await sendEmail(user.email, `🔔 Your Seat is Ready! — ${event.title}`, html);
}

/**
 * Send booking cancellation email.
 */
async function sendBookingCancellation(user, booking, event) {
  const html = renderTemplate('cancellation', {
    customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
    bookingReference: booking.bookingReference,
    eventTitle: event.title,
    eventDate: new Date(event.eventDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    totalAmount: `₹${parseFloat(booking.totalAmount).toFixed(2)}`,
    frontendUrl: process.env.FRONTEND_URL,
  });

  await sendEmail(user.email, `Booking Cancelled — ${booking.bookingReference}`, html);
}

/**
 * Send password reset email.
 */
async function sendPasswordReset(user, resetToken) {
  const resetUrl = `${process.env.FRONTEND_URL}/auth/reset-password?token=${resetToken}`;
  const html = renderTemplate('password-reset', {
    customerName: `${user.firstName || ''}`.trim() || user.email,
    resetUrl,
    resetToken,
  });

  await sendEmail(user.email, '🔐 Reset Your TicketHub Password', html);
}

module.exports = {
  sendBookingConfirmation,
  sendWaitlistOffer,
  sendBookingCancellation,
  sendPasswordReset,
};
