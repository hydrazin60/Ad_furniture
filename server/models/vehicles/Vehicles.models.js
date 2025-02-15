const VehiclesSchema = new mongoose.Schema(
  {
    BranchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    vehicleType: {
      type: String,
      enum: ["Car", "Truck"],
      default: "Car",
    },
    vehicleNumber: {
      type: String,
      unique: true,
      required: [true, "Vehicle number is required"],
    },
    vehicleDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Worker",
    },
    vehicleDescription: {
      type: String,
      default: "",
      max: [500, "Vehicle description must be less than 500 characters"],
    },
    vehicleImage: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    registrationDate: {
      type: Date,
      default: Date.now,
    },
    maintenanceHistory: [
      {
        date: Date,
        description: String,
        cost: Number,
      },
    ],
  },
  {
    timestamps: true,
  }
);
const Vehicles = mongoose.model("Vehicles", VehiclesSchema);
export default Vehicles;
