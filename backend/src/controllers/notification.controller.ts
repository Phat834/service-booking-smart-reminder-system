import { Request, Response, NextFunction } from "express";
import { getNotifications, markNotificationAsRead } from "../services/notification.service";
import { sseService } from "../services/sse.service";

export const getNotificationsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const notifications = await getNotifications(req.user.userId);
    res.status(200).json({ notifications });
  } catch (error) {
    next(error);
  }
};

export const markAsReadHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const { id } = req.params;
    const notification = await markNotificationAsRead(id, req.user.userId);
    res.status(200).json({ notification });
  } catch (error) {
    next(error);
  }
};

export const streamNotificationsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const userId = req.user.userId;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.write("data: " + JSON.stringify({ type: "connected", message: "SSE connection established" }) + "\n\n");
    sseService.addClient(userId, res);
    const heartbeatInterval = setInterval(() => {
      try {
        res.write(": heartbeat\n\n");
      } catch (error) {
        clearInterval(heartbeatInterval);
      }
    }, 30000);
    req.on("close", () => {
      clearInterval(heartbeatInterval);
      sseService.removeClient(userId, res);
    });
  } catch (error) {
    next(error);
  }
};
