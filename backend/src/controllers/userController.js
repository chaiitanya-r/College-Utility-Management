import {
  listUsers as listUsersService,
  createUser as createUserService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
  updateSelfProfile as updateSelfProfileService
} from "../services/userService.js";

export const listUsers = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const users = await listUsersService({ orgId, reqUser: req.user });
    res.json(users);
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const user = await createUserService({
      orgId,
      reqUser: req.user,
      payload: req.body
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { orgId, userId } = req.params;
    const user = await updateUserService({
      orgId,
      userId,
      reqUser: req.user,
      payload: req.body
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { orgId, userId } = req.params;

    await deleteUserService({ orgId, userId, reqUser: req.user });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const updateSelfProfile = async (req, res, next) => {
  try {
    const { orgId } = req.params;
    const userId = req.user.sub || req.user._id;
    const user = await updateSelfProfileService({
      orgId,
      userId,
      payload: req.body
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
};
