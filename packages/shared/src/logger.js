function createEntry(level, message, context) {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  }
}

function write(entry) {
  const line = JSON.stringify(entry) + "\n"
  if (entry.level === "error" || entry.level === "warn") {
    process.stderr.write(line)
  } else {
    process.stdout.write(line)
  }
}

export const logger = {
  error(message, context) {
    write(createEntry("error", message, context))
  },
  warn(message, context) {
    write(createEntry("warn", message, context))
  },
  info(message, context) {
    write(createEntry("info", message, context))
  },
  debug(message, context) {
    write(createEntry("debug", message, context))
  },
}
