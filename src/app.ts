import express, { Application, Request, Response } from "express";
import error from "./middleware/error.js";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import path from "path";
import clientRoutes from "./modules/client/clientRoutes";
import clientPaymentRoutes from "./modules/clientPayment/clientPaymentRoutes";
import employeeRoutes from "./modules/employee/employeeRoutes";
import employeeSalaryRoutes from "./modules/employeeSalary/employeeSalaryRoutes";
import officeExpenseRoutes from "./modules/officeExpense/officeExpenseRoutes";
import userRoutes from "./modules/user/userRoutes";

// 1. Explicitly type the Express application instance
const app: Application = express();

app.set("trust proxy", 1);

const allowedOrigins: string[] = [
  process.env.FRONTEND_URL || "https://app.apexmarketing.cc",
  "http://localhost:3000",
];

// 2. Type the origin callback parameters explicitly
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/clients", clientRoutes);
app.use("/api/v1", clientPaymentRoutes);
app.use("/api/v1/employees", employeeRoutes);
app.use("/api/v1/salaries", employeeSalaryRoutes);
app.use("/api/v1/transactions", officeExpenseRoutes);

app.use(error);

export default app;