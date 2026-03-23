import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import pricesRouter from "./prices";
import scrapeRouter from "./scrape";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(pricesRouter);
router.use(scrapeRouter);

export default router;
