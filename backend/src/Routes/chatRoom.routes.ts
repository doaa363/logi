import { Router } from "express";
import { ChatRoomController } from "../controllers/chatRoom.controller.js";
import { authenticate } from "../middlewares/userAuth.middleware.js";

const router = Router();
const controller = new ChatRoomController();

router.get(
  "/",
  authenticate,
  controller.getRooms.bind(controller)
);

router.get(
  "/:id/messages",
  authenticate,
  controller.getMessages.bind(controller)
);

router.post(
  "/:id/resolve",
  authenticate,
  controller.resolveRoom.bind(controller)
);


router.post(
  "/escalate",
  authenticate,
  controller.createManagerEscalationRoom.bind(controller)
);

export default router;
