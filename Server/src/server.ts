import express from "express";
import cors from "cors";
import helmet from "helmet";
import "dotenv";

const app = express();


const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "API is running"
  });
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
