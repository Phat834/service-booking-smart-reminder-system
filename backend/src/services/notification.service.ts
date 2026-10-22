import { prisma } from '../config/prisma';
import { sseService } from './sse.service';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
}

export const createNotification = async (input: CreateNotificationInput) => {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      message: input.message,
    },
  });

  // Send real-time notification via SSE
  sseService.sendToUser(input.userId, {
    type: 'notification',
    data: notification,
  });

  return notification;
};

export const getNotifications = async (userId: string) => {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
};

export const markNotificationAsRead = async (notificationId: string, userId: string) => {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw new Error('Notification not found');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
};
