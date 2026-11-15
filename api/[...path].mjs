const bundleUrl = new URL("../dist/server/index.mjs", import.meta.url);
const { default: app } = await import(bundleUrl.href);

export default app;
