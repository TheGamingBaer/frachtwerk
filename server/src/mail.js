// E-Mail-Versand (optional). Ohne SMTP-Konfiguration erstellen Admins Reset-Links im Admin-Bereich.
//   SMTP_HOST, SMTP_PORT (587), SMTP_USER, SMTP_PASS, SMTP_FROM ("Frachtwerk <noreply@…>")
let transport = null;
const enabled = () => !!process.env.SMTP_HOST;

function getTransport() {
  if (!transport) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
  }
  return transport;
}

async function sendMail(to, subject, text, html) {
  if (!enabled()) return false;
  await getTransport().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, text, html });
  return true;
}

function resetMail(name, link) {
  const text = `Hallo ${name},\n\ndu hast ein neues Passwort für Frachtwerk angefordert. Der Link ist 1 Stunde gültig:\n\n${link}\n\nFalls du das nicht warst, ignoriere diese E-Mail einfach.\n\nGute Fahrt!\nFrachtwerk`;
  const html = `<div style="font-family:Inter,Arial,sans-serif;background:#05060a;padding:32px;color:#e4e4e7">
    <div style="max-width:480px;margin:auto;background:#0e1119;border:1px solid #262c3f;border-radius:16px;padding:32px">
      <h2 style="margin:0 0 8px;color:#fff">Neues Passwort</h2>
      <p>Hallo ${name}, klicke auf den Button, um ein neues Passwort für Frachtwerk festzulegen. Der Link ist 1 Stunde gültig.</p>
      <p style="margin:28px 0"><a href="${link}" style="background:#ff8a1f;color:#05060a;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">Passwort festlegen</a></p>
      <p style="font-size:12px;color:#71717a">Falls du das nicht angefordert hast, ignoriere diese E-Mail.</p>
    </div></div>`;
  return { text, html };
}

module.exports = { sendMail, resetMail, mailEnabled: enabled };
