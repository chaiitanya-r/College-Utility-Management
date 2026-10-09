import { login as loginService } from "../services/authService.js";

export const login = async (req, res, next) => {
  try {
    const { orgId, email, password } = req.body;

    const result = await loginService({ orgId, email, password });
    return res.json(result);
  } catch (err) {
    next(err);
  }
};
