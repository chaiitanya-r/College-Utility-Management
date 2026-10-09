export const createHttpError = (status, message, options = {}) => {
  const err = new Error(message);
  err.status = status;
  if (options.code) err.code = options.code;
  if (options.details !== undefined) err.details = options.details;
  return err;
};

export const badRequest = (message, options) => createHttpError(400, message, options);
export const unauthorized = (message, options) =>
  createHttpError(401, message || "Unauthorized", options);
export const forbidden = (message, options) =>
  createHttpError(403, message || "Forbidden", options);
export const notFound = (message, options) =>
  createHttpError(404, message || "Not found", options);
export const conflict = (message, options) => createHttpError(409, message, options);
