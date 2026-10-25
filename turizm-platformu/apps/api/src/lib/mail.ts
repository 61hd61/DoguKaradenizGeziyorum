import nodemailer from "nodemailer";

const webBase = process.env.WEB_PUBLIC_URL || "http://localhost:5173";

function transporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || "" }
      : undefined,
  });
}

export async function sendVerificationEmail(email: string, token: string, log: { info: (o: unknown, msg?: string) => void }) {
  const link = `${webBase}/eposta-dogrula?token=${encodeURIComponent(token)}`;
  const subject = "Karadeniz Turizm — E-posta doğrulama";
  const text = `Hesabınızı aktifleştirmek için bağlantıya tıklayın:\n${link}\n\nBağlantı 24 saat geçerlidir.`;

  const tx = transporter();
  if (tx) {
    await tx.sendMail({
      from: process.env.SMTP_FROM || "noreply@turizm.local",
      to: email,
      subject,
      text,
      html: `<p>Hesabınızı aktifleştirmek için <a href="${link}">buraya tıklayın</a>.</p>`,
    });
  } else {
    log.info({ email, verifyLink: link }, "E-posta doğrulama (SMTP yok — geliştirme)");
  }
}

export async function sendPasswordResetEmail(email: string, token: string, log: { info: (o: unknown, msg?: string) => void }) {
  const link = `${webBase}/sifre-sifirla?token=${encodeURIComponent(token)}`;
  const subject = "Karadeniz Turizm — Şifre sıfırlama";
  const text = `Şifrenizi sıfırlamak için:\n${link}`;

  const tx = transporter();
  if (tx) {
    await tx.sendMail({
      from: process.env.SMTP_FROM || "noreply@turizm.local",
      to: email,
      subject,
      text,
      html: `<p><a href="${link}">Şifre sıfırlama bağlantısı</a></p>`,
    });
  } else {
    log.info({ email, resetLink: link }, "Sifre sifirlama (SMTP yok — geliştirme)");
  }
}
