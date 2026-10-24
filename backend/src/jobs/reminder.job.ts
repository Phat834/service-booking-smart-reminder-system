import cron from "node-cron";
import { prisma } from "../config/prisma";
import { emailService } from "../services/email.service";
import { createNotification } from "../services/notification.service";
import { sseService } from "../services/sse.service";

export const startReminderJob = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("[Reminder Job] Checking for bookings needing reminders...");
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const bookings24h = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          isReminderSent: false,
          bookingDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
            lte: in24Hours,
          },
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          staff: { select: { id: true, fullName: true, email: true, phone: true } },
          service: { select: { id: true, name: true, durationMinutes: true, price: true } },
          timeSlot: { select: { id: true, startTime: true, endTime: true } },
        },
      });

      for (const booking of bookings24h) {
        try {
          await emailService.sendBookingReminder(booking);
          await prisma.booking.update({
            where: { id: booking.id },
            data: { isReminderSent: true },
          });
          await createNotification({
            userId: booking.customerId,
            title: "Nhắc lịch hẹn (24h)",
            message: `Lịch hẹn của bạn sắp diễn ra vào ${new Date(booking.bookingDate).toLocaleDateString("vi-VN")} ${booking.timeSlot.startTime}`,
          });
          console.log("[Reminder Job] 24h reminder sent for booking " + booking.id);
        } catch (error) {
          console.error("[Reminder Job] Failed to send 24h reminder for booking " + booking.id + ":", error);
        }
      }

      const bookings2h = await prisma.booking.findMany({
        where: {
          status: "CONFIRMED",
          isReminder2hSent: false,
          bookingDate: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
        include: {
          customer: { select: { id: true, fullName: true, email: true, phone: true } },
          staff: { select: { id: true, fullName: true, email: true, phone: true } },
          service: { select: { id: true, name: true, durationMinutes: true, price: true } },
          timeSlot: { select: { id: true, startTime: true, endTime: true } },
        },
      });

      for (const booking of bookings2h) {
        try {
          const dateOnly = new Date(booking.bookingDate);
          const [h, m] = booking.timeSlot.startTime.split(":").map(Number);
          const start = new Date(Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), h, m, 0));
          if (start > now && start <= in2Hours) {
            await emailService.sendBookingReminder(booking);
            await prisma.booking.update({
              where: { id: booking.id },
              data: { isReminder2hSent: true },
            });
            await createNotification({
              userId: booking.customerId,
              title: "Nhắc lịch hẹn khẩn (2h)",
              message: `Lịch hẹn của bạn sẽ diễn ra sau 2 giờ nữa lúc ${booking.timeSlot.startTime}`,
            });
            sseService.sendToUser(booking.customerId, { type: "reminder:2h", data: booking });
            console.log("[Reminder Job] 2h reminder sent for booking " + booking.id);
          }
        } catch (error) {
          console.error("[Reminder Job] Failed to send 2h reminder for booking " + booking.id + ":", error);
        }
      }
    } catch (error) {
      console.error("[Reminder Job] Error:", error);
    }
  });

  console.log("[Reminder Job] Started - running every 15 minutes (24h + 2h)");
};
