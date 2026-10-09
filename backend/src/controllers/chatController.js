import { processChat as ruleBasedProcessChat } from "../services/chatbotService.js";
import { processChat as geminiProcessChat } from "../services/geminiChatbotService.js";
import { recordChatUsage } from "../services/chatbotUsageService.js";

export const chat = async (req, res, next) => {
  try {
    let result;
    let provider = "rule-based";
    if (process.env.GEMINI_API_KEY) {
      result = await geminiProcessChat({ reqUser: req.user, body: req.body });
      provider = "gemini";
    } else {
      result = await ruleBasedProcessChat({ reqUser: req.user, body: req.body });
    }

    recordChatUsage({ reqUser: req.user, body: req.body, result, provider }).catch(() => {});

    res.json(result);
  } catch (err) {
    next(err);
  }
};

