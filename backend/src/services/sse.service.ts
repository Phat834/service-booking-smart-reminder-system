import { Response } from "express";

class SSEService {
  private clients: Map<string, Set<Response>> = new Map();

  addClient(userId: string, res: Response): void {
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId)!.add(res);

    res.on("close", () => {
      this.removeClient(userId, res);
    });
  }

  removeClient(userId: string, res: Response): void {
    const clientSet = this.clients.get(userId);
    if (clientSet) {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  sendToUser(userId: string, data: unknown, event?: string): void {
    const clientSet = this.clients.get(userId);
    if (!clientSet || clientSet.size === 0) return;

    const payload = typeof data === "string" ? data : JSON.stringify(data);
    const message = event ? "event: " + event + "\ndata: " + payload + "\n\n" : "data: " + payload + "\n\n";

    for (const res of clientSet) {
      try {
        res.write(message);
      } catch (error) {
        this.removeClient(userId, res);
      }
    }
  }

  broadcast(data: unknown, event?: string): void {
    for (const userId of this.clients.keys()) {
      this.sendToUser(userId, data, event);
    }
  }
}

export const sseService = new SSEService();
