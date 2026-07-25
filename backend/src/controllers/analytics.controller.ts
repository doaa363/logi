import type { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service.js";
import type { AuthRequest } from "../middlewares/userAuth.middleware.js";

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async getDashboard(req: AuthRequest, res: Response) {
    try {
      const metrics = await analyticsService.getDashboardMetrics(req.user?.companyId);
      return res.status(200).json({ success: true, data: metrics });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
