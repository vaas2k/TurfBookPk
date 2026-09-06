import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./configs/env.js";
import { DrizzleAuthRepository } from "./database/drizzleAuthRepository.js";
import { getErrorMessage } from "./helpers/errors.js";
import { AuthController } from "./controllers/authController.js";
import { createAuthRouter } from "./router/authRoutes.js";
import { AuthService } from "./services/authService.js";
import { OtpService } from "./services/otpService.js";
import { TokenService } from "./services/tokenService.js";
import { VendorController } from './controllers/vendorController.js';
import { createVendorRouter } from './router/vendorRoutes.js';

const app = express();


app.use(helmet());
app.use(cors({
  origin: env.nodeEnv === 'production' ? env.frontendUrl : '*',
}));
app.use(express.json());

const repository = new DrizzleAuthRepository();
const otpService = new OtpService(repository);
const tokenService = new TokenService(repository);
const authService = new AuthService(repository, otpService, tokenService);
const authController = new AuthController(authService, tokenService);
const vendorController = new VendorController();

app.use('/api/auth', createAuthRouter(authController, tokenService));
app.use('/api/vendors', createVendorRouter(vendorController, tokenService));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "API is running"
  });
});
app.get("/api/test", async (_req, res) => {
  res.json({
    status: "ok",
    message: "Test endpoint is working"
  });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
    ? Number(error.statusCode)
    : 500;
  if (statusCode >= 500) console.error(error);
  response.status(statusCode).json({
    error: {
      code: typeof error === 'object' && error !== null && 'code' in error ? error.code : 'internal_error',
      message: statusCode === 500 ? 'An unexpected server error occurred' : getErrorMessage(error),
    },
  });
});

app.listen(env.port, () => {
  console.log(`Server is running on port ${env.port}`);
});
