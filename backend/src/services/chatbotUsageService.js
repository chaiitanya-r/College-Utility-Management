import { ChatbotUsage } from "../models/ChatbotUsage.js";
import { User } from "../models/User.js";
import { Organization } from "../models/Organization.js";

export const recordChatUsage = async ({ reqUser, body, result, provider }) => {
  try {
    const messages = body?.messages || [];
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    const replyText = result?.reply || "";

    const usageMeta = result?.meta?.usageMetadata;
    const promptTokens = usageMeta?.promptTokenCount || Math.ceil((lastUserMsg.length || 10) / 3.5);
    const candidateTokens = usageMeta?.candidatesTokenCount || Math.ceil((replyText.length || 10) / 3.5);
    const totalTokens = usageMeta?.totalTokenCount || (promptTokens + candidateTokens);

    let orgName = reqUser?.orgName || "Platform / General";
    let orgId = reqUser?.organizationId || null;
    let userName = reqUser?.name || "User";
    let userEmail = reqUser?.email || "";
    let userRole = reqUser?.role || "faculty";
    let userId = reqUser?.id || null;

    if (userId && (!userName || userName === "User" || !userEmail)) {
      const dbUser = await User.findById(userId).lean();
      if (dbUser) {
        userName = dbUser.name || userName;
        userEmail = dbUser.email || userEmail;
        userRole = dbUser.role || userRole;
        if (!orgId) orgId = dbUser.organizationId;
      }
    }

    if (orgId && (!orgName || orgName === "Platform / General")) {
      const dbOrg = await Organization.findById(orgId).lean();
      if (dbOrg) orgName = dbOrg.name;
    }

    await ChatbotUsage.create({
      organizationId: orgId,
      organizationName: orgName,
      userId,
      userName,
      userEmail,
      userRole,
      promptTokens,
      candidateTokens,
      totalTokens,
      promptSnippet: lastUserMsg.slice(0, 200),
      toolsUsed: result?.meta?.toolsUsed || [],
      provider: provider || (process.env.GEMINI_API_KEY ? "gemini" : "rule-based"),
    });
  } catch (err) {
    console.error("[recordChatUsage] Error recording usage log:", err.message);
  }
};

export const getChatbotUsageStats = async () => {
  const totalSummary = await ChatbotUsage.aggregate([
    {
      $group: {
        _id: null,
        totalTokens: { $sum: "$totalTokens" },
        promptTokens: { $sum: "$promptTokens" },
        candidateTokens: { $sum: "$candidateTokens" },
        totalRequests: { $sum: 1 },
      },
    },
  ]);

  const summary = totalSummary[0] || {
    totalTokens: 0,
    promptTokens: 0,
    candidateTokens: 0,
    totalRequests: 0,
  };

  const topOrganizations = await ChatbotUsage.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$organizationName", "Platform / General"] },
        totalTokens: { $sum: "$totalTokens" },
        requestCount: { $sum: 1 },
      },
    },
    { $sort: { totalTokens: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        organizationName: "$_id",
        totalTokens: 1,
        requestCount: 1,
      },
    },
  ]);

  const topUsers = await ChatbotUsage.aggregate([
    {
      $group: {
        _id: { $ifNull: ["$userEmail", "$userName"] },
        userName: { $first: "$userName" },
        userEmail: { $first: "$userEmail" },
        userRole: { $first: "$userRole" },
        organizationName: { $first: "$organizationName" },
        totalTokens: { $sum: "$totalTokens" },
        requestCount: { $sum: 1 },
      },
    },
    { $sort: { totalTokens: -1 } },
    { $limit: 15 },
    {
      $project: {
        _id: 0,
        userName: 1,
        userEmail: 1,
        userRole: 1,
        organizationName: 1,
        totalTokens: 1,
        requestCount: 1,
      },
    },
  ]);

  const recentLogs = await ChatbotUsage.find({})
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  return {
    summary,
    topOrganizations,
    topUsers,
    recentLogs,
  };
};
