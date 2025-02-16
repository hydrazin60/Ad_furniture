import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import staffAuthRouter from "./routes/Auth/staffAuth.routes.js";
import BranchRouter from "./routes/Branch/Branch.routes.js";
import invoiceRouter from "./routes/invoices/invoices.routes.js";
import productRouter from "./routes/product/product.routes.js";
import VehiclesRouter from "./routes/Vehicles/Vehicles.routes.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 4000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// app.use(
//   cors({
//     origin: "http://localhost:5173",
//     credentials: true,
//     allowedHeaders: ["Content-Type", "Authorization"],
//   })
// );

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/v1/ad_furniture/staff/auth", staffAuthRouter);
app.use("/api/v1/ad_furniture/branch", BranchRouter);
app.use("/api/v1/ad_furniture/invoices", invoiceRouter);
app.use("/api/v1/ad_furniture/product", productRouter);
app.use("/api/v1/ad_furniture/vehicles", VehiclesRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
