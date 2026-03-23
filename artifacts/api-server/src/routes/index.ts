import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import pricesRouter from "./prices";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(pricesRouter);

export default router;
