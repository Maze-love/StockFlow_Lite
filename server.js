import dotenv from "dotenv";
import app from "./app.js";
import { startReservationExpiryJob } from "./jobs/expireReservations.js";

dotenv.config();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  // start the background reservation expiry ticker
  startReservationExpiryJob();
});
