const levelOrder = { error: 0, warn: 1, info: 2, debug: 3 };

const minLevel =
  levelOrder[process.env.LOG_LEVEL?.toLowerCase()] ?? levelOrder.info;

const write = (level, module, message, meta) => {
  if (levelOrder[level] > minLevel) return;
  const prefix = module ? `[${module}]` : "";
  const line = `${prefix} ${message}`.trim();
  if (meta !== undefined) {
    console[level === "debug" ? "log" : level](line, meta);
  } else {
    console[level === "debug" ? "log" : level](line);
  }
};

export const createLogger = (module) => ({
  error: (message, meta) => write("error", module, message, meta),
  warn: (message, meta) => write("warn", module, message, meta),
  info: (message, meta) => write("info", module, message, meta),
  debug: (message, meta) => write("debug", module, message, meta)
});

export const log = createLogger("app");
