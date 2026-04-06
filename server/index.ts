import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

app.listen(port, () => {
  // Keep startup logging minimal but explicit so local debugging is easy.
  console.log(`deep-read-pro api listening on http://localhost:${port}`);
});
