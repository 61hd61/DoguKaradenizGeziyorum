// Email Service - Nodemailer wrapper
import nodemailer from "nodemailer";
import { config } from "../config";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: config.email.user && config.email.pass ? {
          user: config.email.user,
          pass: config.email.pass,
        } : undefined,
      });
    }
    return this.transporter;
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.sendMail({
        from: config.email.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""),
      });
      return true;
    } catch (error) {
      console.error("Email send error:", error);
      return false;
    }
  }

  // Email verification
  async sendVerificationEmail(email: string, username: string, token: string): Promise<boolean> {
    const verifyUrl = `${config.email.verifyUrl}?token=${token}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🌄 Turizm Platformu</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #333; margin-top: 0;">Hoş geldiniz, ${username}!</h2>
            <p style="font-size: 16px; color: #555;">Hesabınızı aktifleştirmek için aşağıdaki butona tıklayın:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">E-posta Adresimi Doğrula</a>
            </div>
            <p style="font-size: 14px; color: #888;">Bu link 24 saat geçerlidir. Eğer siz kayıt olmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #aaa;">Link çalışmıyorsa tarayıcınıza kopyalayın: ${verifyUrl}</p>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to: email,
      subject: "Turizm Platformu - E-posta Doğrulama",
      html,
    });
  }

  // Password reset
  async sendPasswordResetEmail(email: string, username: string, token: string): Promise<boolean> {
    const resetUrl = `${config.email.resetUrl}?token=${token}`;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Şifre Sıfırlama</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #333; margin-top: 0;">Merhaba ${username},</h2>
            <p style="font-size: 16px; color: #555;">Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Şifremi Sıfırla</a>
            </div>
            <p style="font-size: 14px; color: #888;">Bu link 1 saat geçerlidir. Eğer şifre sıfırlama talebinde bulunmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 12px; color: #aaa;">Link çalışmıyorsa tarayıcınıza kopyalayın: ${resetUrl}</p>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to: email,
      subject: "Turizm Platformu - Şifre Sıfırlama",
      html,
    });
  }

  // Welcome email after verification
  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Hesabınız Aktif!</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #333; margin-top: 0;">Hoş geldiniz, ${username}!</h2>
            <p style="font-size: 16px; color: #555;">E-posta adresiniz başarıyla doğrulandı. Artık Turizm Platformu'nun tüm özelliklerinden yararlanabilirsiniz:</p>
            <ul style="font-size: 16px; color: #555; padding-left: 20px;">
              <li>🗺️ Karadeniz'in güzel destinasyonlarını keşfedin</li>
              <li>🧭 Kendi tur rotanızı oluşturun</li>
              <li>⭐ Yerleri puanlayın ve yorum yapın</li>
              <li>📝 Seyahat blogunuzu yazın</li>
              <li>👥 Diğer gezginleri takip edin</li>
            </ul>
            <div style="text-align: center; margin: 30px 0;">
              <a href="http://localhost:5173" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Platformu Keşfet</a>
            </div>
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to: email,
      subject: "Turizm Platformu - Hoş Geldiniz! 🎉",
      html,
    });
  }

  // Notification email
  async sendNotificationEmail(email: string, username: string, title: string, message: string, actionUrl?: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">📬 Yeni Bildirim</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px;">
            <h2 style="color: #333; margin-top: 0;">${title}</h2>
            <p style="font-size: 16px; color: #555;">${message}</p>
            ${actionUrl ? `
            <div style="text-align: center; margin: 30px 0;">
              <a href="${actionUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Görüntüle</a>
            </div>
            ` : ""}
          </div>
        </body>
      </html>
    `;
    return this.sendEmail({
      to: email,
      subject: `Turizm Platformu - ${title}`,
      html,
    });
  }

  // Test connection
  async verifyConnection(): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      await transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}

export const emailService = new EmailService();