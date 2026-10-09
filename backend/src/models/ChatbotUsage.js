import mongoose from "mongoose";

const ChatbotUsageSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", required: false, default: null },
    organizationName: { type: String, default: "Platform / General" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false, default: null },
    userName: { type: String, default: "Anonymous" },
    userEmail: { type: String, default: "" },
    userRole: { type: String, default: "faculty" },
    promptTokens: { type: Number, default: 0 },
    candidateTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    promptSnippet: { type: String, default: "" },
    toolsUsed: [String],
    provider: { type: String, default: "gemini" }, // "gemini" or "rule-based"
  },
  { timestamps: true }
);

ChatbotUsageSchema.index({ organizationId: 1 });
ChatbotUsageSchema.index({ userId: 1 });
ChatbotUsageSchema.index({ createdAt: -1 });

export const ChatbotUsage = mongoose.model("ChatbotUsage", ChatbotUsageSchema);
