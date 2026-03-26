import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import pricesRouter from "./prices";
import scrapeRouter from "./scrape";
import calendarRouter from "./calendar";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(pricesRouter);
router.use(scrapeRouter);
router.use(calendarRouter);

export default router;
