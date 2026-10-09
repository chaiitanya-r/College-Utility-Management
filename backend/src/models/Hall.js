import mongoose from "mongoose";

const HallSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["seminar_hall", "lab", "auditorium", "classroom", "sports"],
      required: true
    },
    capacity: { type: Number, required: true },
    location: { type: String, required: true },
    amenities: { type: [String], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Hall = mongoose.model("Hall", HallSchema);
