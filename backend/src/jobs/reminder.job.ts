import cron from "node-cron";
import { prisma } from "../config/prisma";
import { emailService } from "../services/email.service";

export const startReminderJob = () => {
  cron.schedule("*/15 * * * *", async () => {
    try {
      console.log("[Reminder Job] Checking for bookings needing reminders...");
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const bookings = await prisma.booking.findMany({
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

      console.log("[Reminder Job] Found " + bookings.length + " bookings to remind");

      for (const booking of bookings) {
        try {
          await emailService.sendBookingReminder(booking);
          await prisma.booking.update({
            where: { id: booking.id },
            data: { isReminderSent: true },
          });
          console.log("[Reminder Job] Reminder sent for booking " + booking.id);
        } catch (error) {
          console.error("[Reminder Job] Failed to send reminder for booking " + booking.id + ":", error);
        }
      }
    } catch (error) {
      console.error("[Reminder Job] Error:", error);
    }
  });

  console.log("[Reminder Job] Started - running every 15 minutes");
};
