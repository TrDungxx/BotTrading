module.exports = {
  apiKey: process.env.APPLITOOLS_API_KEY,
  concurrency: 5,
  browser: [
    { name: 'chrome', width: 1440, height: 900 },
    { name: 'chrome', width: 1024, height: 768 },
    { name: 'chrome', width: 768, height: 1024 },
    { name: 'chrome', width: 390, height: 844 },
    { name: 'firefox', width: 1366, height: 768 },
    { name: 'safari', width: 1280, height: 800 },
  ],
  layoutBreakpoints: true,
};
