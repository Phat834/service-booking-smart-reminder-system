import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: any = null;

  private async getTransporter() {
    if (this.transporter) return this.transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      return this.transporter;
    }

    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
      console.log('Using Ethereal Email for testing:', testAccount.user);
      return this.transporter;
    } catch (e) {
      console.log('Email service using console fallback (no SMTP configured)');
      this.transporter = nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true } as any);
      return this.transporter;
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      const transporter = await this.getTransporter();
      if ((transporter as any).options?.streamTransport) {
        await transporter.sendMail({
          from: process.env.EMAIL_FROM || '\"Service Booking\" <noreply@servicebooking.com>',
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || options.html.replace(/<[^>]*>/g, ''),
        });
        console.log('\n========== EMAIL (CONSOLE FALLBACK) ==========');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Content:');
        console.log(options.html);
        console.log('===============================================\n');
        return;
      }
      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || '\"Service Booking\" <noreply@servicebooking.com>',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ''),
      });
      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.log('Email preview URL:', previewUrl);
    } catch (error) {
      console.error('Failed to send email:', error);
      console.log('\n========== EMAIL (ERROR FALLBACK) ==========');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Content:');
      console.log(options.html);
      console.log('=============================================\n');
    }
  }

  async sendBookingReminder(booking: any): Promise<void> {
    const customerName = booking.customer?.fullName || 'Quy khach';
    const serviceName = booking.service?.name || 'N/A';
    const staffName = booking.staff?.fullName || 'N/A';
    const bookingDate = new Date(booking.bookingDate).toLocaleDateString('vi-VN');
    const startTime = booking.timeSlot?.startTime || 'N/A';
    const endTime = booking.timeSlot?.endTime || 'N/A';
    const notes = booking.notes ? '<p><strong>Ghi chu:</strong> ' + booking.notes + '</p>' : '';
    const html = '<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;line-height:1.6;color:#333}.container{max-width:600px;margin:0 auto;padding:20px}.header{background-color:#4CAF50;color:white;padding:20px;text-align:center}.content{padding:20px;background-color:#f9f9f9}.details{background-color:white;padding:15px;margin:15px 0;border-radius:5px}.footer{text-align:center;padding:20px;color:#666;font-size:12px}</style></head><body><div class=\"container\"><div class=\"header\"><h1>Nhac nho lich hen</h1></div><div class=\"content\"><p>Xin chao <strong>' + customerName + '</strong>,</p><p>Day la email nhac nho ve lich hen sap toi cua ban trong vong 24 gio.</p><div class=\"details\"><h3>Thong tin lich hen:</h3><p><strong>Dich vu:</strong> ' + serviceName + '</p><p><strong>Nhan vien:</strong> ' + staffName + '</p><p><strong>Ngay:</strong> ' + bookingDate + '</p><p><strong>Gio:</strong> ' + startTime + ' - ' + endTime + '</p>' + notes + '</div><p>Vui long den dung gio. Neu ban can thay doi hoac huy lich hen, vui long lien he voi chung toi.</p><p>Tran trong,<br>Doi ngu Service Booking</p></div><div class=\"footer\"><p>Email nay duoc gui tu dong, vui long khong tra loi.</p></div></div></body></html>';
    await this.sendEmail({ to: booking.customer?.email || '', subject: 'Nhac nho lich hen - Sap dien ra trong 24h', html });
  }
}

export const emailService = new EmailService();
