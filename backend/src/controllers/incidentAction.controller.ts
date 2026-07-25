import type { Response } from "express";
import type { AuthRequest } from "../middlewares/userAuth.middleware.js";
import { Incident } from "../models/Incedent.model.js";
import { ChatRoom, ChatRoomType } from "../models/ChatRoom.model.js";
import { UserRole } from "../types/user.type.js";
import { getIo } from "../socket/socket.js";
import mongoose from "mongoose";

export class IncidentActionController {
  /**
   * PATCH /api/incidents/:id/assign
   * Assigns or re-assigns a CS_AGENT to the incident.
   * Auto-adds the assigned agent to the corresponding INCIDENT ChatRoom.
   */
  async assignAgent(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { agentId } = req.body;
      const companyId = req.user?.companyId;

      if (!id || !agentId || !companyId || !mongoose.Types.ObjectId.isValid(id as string) || !mongoose.Types.ObjectId.isValid(agentId as string)) {
        return res.status(400).json({ success: false, message: "Invalid incident ID or agent ID, or missing context" });
      }

      const incident = await Incident.findOne({
        _id: new mongoose.Types.ObjectId(id as string),
        companyId: new mongoose.Types.ObjectId(companyId as string),
      });

      if (!incident) {
        return res.status(404).json({ success: false, message: "Incident not found" });
      }

      // Update assignment
      const newAssigneeId = new mongoose.Types.ObjectId(agentId as string);
      incident.assignedTo = newAssigneeId;
      await incident.save();

      // If the incident has a ChatRoom (or if we can find one linked to it), add the agent
      if (incident.chatRoomId) {
        const room = await ChatRoom.findOne({ _id: incident.chatRoomId, companyId: incident.companyId });
        
        if (room) {
          // Check if already in participants
          const alreadyInRoom = room.participants.some((p: mongoose.Types.ObjectId) => String(p) === String(newAssigneeId));
          if (!alreadyInRoom) {
            room.participants.push(newAssigneeId);
            await room.save();

            // Emit an invite event so the agent's client joins the room automatically
            const io = getIo();
            if (io) {
              io.to(`user_${String(newAssigneeId)}`).emit("chat:invited", {
                roomId: room._id,
                incidentId: incident._id,
                message: "You have been assigned to an incident and added to its chat room."
              });
            }
          }
        }
      }

      return res.status(200).json({
        success: true,
        message: "Agent assigned successfully.",
        data: incident
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * POST /api/incidents/:id/escalate
   * Escalate the incident to the OWNER's attention.
   * Only CS_MANAGER can perform this action.
   */
  async escalateIncident(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!id || !companyId || !mongoose.Types.ObjectId.isValid(id as string)) {
        return res.status(400).json({ success: false, message: "Invalid incident ID or missing context" });
      }

      const incident = await Incident.findOne({
        _id: new mongoose.Types.ObjectId(id as string),
        companyId: new mongoose.Types.ObjectId(companyId as string),
      });

      if (!incident) {
        return res.status(404).json({ success: false, message: "Incident not found" });
      }

      if (incident.escalatedByManager) {
        return res.status(400).json({ success: false, message: "Incident is already escalated." });
      }

      incident.escalatedByManager = true;
      incident.escalatedBy = new mongoose.Types.ObjectId(req.user?.sub);
      await incident.save();

      // Notify the OWNER via socket
      const io = getIo();
      if (io) {
        io.to(`company_owners_${companyId}`).emit("incident:escalated", {
          incidentId: incident._id,
          escalatedBy: req.user?.sub,
          message: "An incident has been escalated to your attention."
        });
      }

      return res.status(200).json({
        success: true,
        message: "Incident escalated successfully.",
        data: incident
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
