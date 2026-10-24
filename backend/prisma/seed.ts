import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("123456", 10);

  const admin = await prisma.user.create({
    data: { fullName: "Admin Demo", email: "admin@demo.com", passwordHash, role: "ADMIN", phone: "0900000000" },
  });
  const staff1 = await prisma.user.create({
    data: { fullName: "Staff One", email: "staff1@demo.com", passwordHash, role: "STAFF", phone: "0900000001" },
  });
  const staff2 = await prisma.user.create({
    data: { fullName: "Staff Two", email: "staff2@demo.com", passwordHash, role: "STAFF", phone: "0900000002" },
  });
  const customer1 = await prisma.user.create({
    data: { fullName: "Customer One", email: "customer1@demo.com", passwordHash, role: "CUSTOMER", phone: "0900000003" },
  });
  const customer2 = await prisma.user.create({
    data: { fullName: "Customer Two", email: "customer2@demo.com", passwordHash, role: "CUSTOMER", phone: "0900000004" },
  });

  const services = await Promise.all([
    prisma.service.create({ data: { name: "Haircut", description: "Basic haircut", durationMinutes: 30, bufferMinutes: 15, price: 100000, isActive: true } }),
    prisma.service.create({ data: { name: "Hair Coloring", description: "Full hair coloring", durationMinutes: 90, bufferMinutes: 15, price: 500000, isActive: true } }),
    prisma.service.create({ data: { name: "Manicure", description: "Nail care", durationMinutes: 45, bufferMinutes: 10, price: 150000, isActive: true } }),
    prisma.service.create({ data: { name: "Facial", description: "Skin facial treatment", durationMinutes: 60, bufferMinutes: 15, price: 300000, isActive: true } }),
    prisma.service.create({ data: { name: "Massage", description: "Relaxing massage", durationMinutes: 60, bufferMinutes: 15, price: 400000, isActive: true } }),
  ]);

  const slotDefs = [
    ["08:00", "08:30"], ["08:30", "09:00"], ["09:00", "09:30"], ["09:30", "10:00"],
    ["10:00", "10:30"], ["10:30", "11:00"], ["13:00", "13:30"], ["13:30", "14:00"],
  ];
  const slots = await Promise.all(slotDefs.map(([s, e]) => prisma.timeSlot.create({ data: { startTime: s, endTime: e } })));

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const dateStr = `${yyyy}-${mm}-${dd}`;
  const bookingDate = new Date(`${dateStr}T00:00:00.000Z`);

  await prisma.booking.create({
    data: { customerId: customer1.id, staffId: staff1.id, serviceId: services[0].id, timeSlotId: slots[0].id, bookingDate, status: "PENDING", notes: "First booking" },
  });
  await prisma.booking.create({
    data: { customerId: customer2.id, staffId: staff2.id, serviceId: services[2].id, timeSlotId: slots[3].id, bookingDate, status: "CONFIRMED", notes: "Confirmed booking" },
  });
  await prisma.booking.create({
    data: { customerId: customer1.id, staffId: staff1.id, serviceId: services[3].id, timeSlotId: slots[5].id, bookingDate, status: "COMPLETED", isReminderSent: true },
  });
  await prisma.booking.create({
    data: { customerId: customer2.id, staffId: staff2.id, serviceId: services[4].id, timeSlotId: slots[7].id, bookingDate, status: "CANCELLED", notes: "Cancelled" },
  });

  await prisma.notification.create({
    data: { userId: customer1.id, title: "Booking created", message: "Your booking is pending", isRead: false },
  });
  await prisma.notification.create({
    data: { userId: staff1.id, title: "New assignment", message: "You have a new booking", isRead: false },
  });

  console.log("Seed completed");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
