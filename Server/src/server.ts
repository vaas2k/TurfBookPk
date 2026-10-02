import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./configs/env.js";
import { DrizzleAuthRepository } from "./database/drizzleAuthRepository.js";
import { databaseConstraintError, getErrorMessage, requestParsingError } from "./helpers/errors.js";
import { AuthController } from "./controllers/authController.js";
import { createAuthRouter } from "./router/authRoutes.js";
import { AuthService } from "./services/authService.js";
import { OtpService } from "./services/otpService.js";
import { TokenService } from "./services/tokenService.js";
import { VendorController } from './controllers/vendorController.js';
import { createVendorRouter } from './router/vendorRoutes.js';
import { GroundController } from './controllers/groundController.js';
import { createGroundRouter } from './router/groundRoutes.js';
import { BookingController } from './controllers/bookingController.js';
import { createBookingRouter } from './router/bookingRoutes.js';
import { requireJsonBody } from './middleware/requestValidation.js';
import { BookingMaintenanceService } from './services/bookingMaintenance.js';
import { NotificationController } from './controllers/notificationController.js';
import { createNotificationRouter } from './router/notificationRoutes.js';
import { ReviewController } from './controllers/reviewController.js';
import { createReviewRouter } from './router/reviewRoutes.js';
import { MediaController } from './controllers/mediaController.js';
import { CloudinaryStorageProvider } from './services/cloudinaryStorageProvider.js';
import { createMediaRouter } from './router/mediaRoutes.js';
import { EngagementController } from './controllers/engagementController.js';
import { createEngagementRouter } from './router/engagementRoutes.js';
import { processExpoPushReceipts } from './services/expoPushService.js';
import { AdminController } from './controllers/adminController.js';
import { createAdminRouter } from './router/adminRoutes.js';

const app = express();


app.use(helmet());
app.use(cors({
  origin: env.nodeEnv === 'production' ? env.frontendUrl : '*',
}));
app.use(express.json({ limit: '32kb', strict: true }));

app.use((request, response, next) => {
  if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
    requireJsonBody(request, response, next);
    return;
  }
  next();
});

const repository = new DrizzleAuthRepository();
const otpService = new OtpService(repository);
const tokenService = new TokenService(repository);
const authService = new AuthService(repository, otpService, tokenService);
const authController = new AuthController(authService, tokenService);
const vendorController = new VendorController();
const groundController = new GroundController();
const bookingController = new BookingController();
const bookingMaintenance = new BookingMaintenanceService();
const notificationController = new NotificationController();
const reviewController = new ReviewController();
const mediaController = new MediaController(new CloudinaryStorageProvider());
const engagementController = new EngagementController();
const adminController = new AdminController();

app.use('/api/auth', createAuthRouter(authController, tokenService));
app.use('/api/vendors', createVendorRouter(vendorController, tokenService));
app.use('/api/grounds', createGroundRouter(groundController, tokenService));
app.use('/api/bookings', createBookingRouter(bookingController, tokenService));
app.use('/api/notifications', createNotificationRouter(notificationController, tokenService));
app.use('/api/reviews', createReviewRouter(reviewController, tokenService));
app.use('/api/media', createMediaRouter(mediaController, tokenService));
app.use('/api/engagement', createEngagementRouter(engagementController, tokenService));
app.use('/api/admin', createAdminRouter(adminController, tokenService));

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
  const normalizedError = requestParsingError(error) || databaseConstraintError(error) || error;
  const statusCode = typeof normalizedError === 'object' && normalizedError !== null && 'statusCode' in normalizedError
    ? Number(normalizedError.statusCode)
    : 500;
  if (statusCode >= 500) console.error(normalizedError);
  response.status(statusCode).json({
    error: {
      code: typeof normalizedError === 'object' && normalizedError !== null && 'code' in normalizedError ? normalizedError.code : 'internal_error',
      message: statusCode === 500 ? 'An unexpected server error occurred' : getErrorMessage(normalizedError),
    },
  });
});

app.listen(env.port, () => {
  console.log(`Server is running on port ${env.port}`);
});

const bookingMaintenanceTimer = setInterval(() => {
  bookingMaintenance.completeEndedBookings().catch((error) => console.error('Booking maintenance failed', error));
}, 60_000);
bookingMaintenanceTimer.unref();

const pushReceiptTimer = setInterval(() => {
  processExpoPushReceipts().catch((error) => console.error('Push receipt processing failed', error));
}, 5 * 60_000);
pushReceiptTimer.unref();
