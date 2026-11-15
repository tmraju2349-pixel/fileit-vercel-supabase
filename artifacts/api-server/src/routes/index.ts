import { Router, type IRouter } from "express";
import filesRouter from "./files.js";
import { convertRouter } from "./convert.js";
import webrtcRouter from "./webrtc.js";

const router: IRouter = Router();

router.use(filesRouter);
router.use(convertRouter);
router.use(webrtcRouter);

export default router;
