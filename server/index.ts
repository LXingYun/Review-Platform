import "dotenv/config";
import { createApp } from "./app";
import { initializeReviewWorkers } from "./services/review-service";

const port = Number(process.env.PORT ?? 8787);
const app = createApp();

initializeReviewWorkers();

app.listen(port, () => {
  console.log(`deep-read-pro api listening on http://localhost:${port}`);
});
