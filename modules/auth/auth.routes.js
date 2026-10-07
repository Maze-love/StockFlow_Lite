import express from "express";
import * as authController from "./auth.controller.js";
import authenticate from "../../middleware/authenticate.js";

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.get("/me", authenticate, authController.getMe);

export default router;
