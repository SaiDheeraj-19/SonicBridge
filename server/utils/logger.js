const logger = {
    info: (msg, meta = {}) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${msg}`, meta);
    },
    error: (msg, error = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`, error);
    },
    latency: (label, startTime) => {
        const duration = Date.now() - startTime;
        console.log(`[LATENCY] ${label}: ${duration}ms`);
        return duration;
    }
};

export default logger;
