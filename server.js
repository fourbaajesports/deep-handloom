
import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Confirm backend is running
app.get("/", (req, res) => {
  res.send("Deep Handloom backend is running");
});

// Search Google Images using SerpApi
app.get("/api/images", async (req, res) => {
  console.log("IMAGE ROUTE HIT");

  try {
    const code = String(req.query.code || "").trim();

    if (!code) {
      return res.status(400).json({
        error: "Product code is required",
      });
    }

    const apiKey = process.env.SERPAPI_API_KEY;

    console.log("API key loaded:", Boolean(apiKey));

    if (!apiKey) {
      return res.status(500).json({
        error: "API key is missing in .env",
      });
    }

    const params = new URLSearchParams({
      engine: "google_images",
      q: `${code} clothing product`,
      api_key: apiKey,
    });

    const response = await fetch(
      `https://serpapi.com/search.json?${params.toString()}`
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("SerpApi error:", data.error || response.status);

      return res.status(502).json({
        error: data.error || "Image search failed",
      });
    }

    const images = (data.images_results || []).map((item) => ({
      title: item.title || "",
      imageUrl: item.original || item.thumbnail || "",
      thumbnail: item.thumbnail || "",
      source: item.source || "",
      link: item.link || "",
    }));

    return res.json({ code, images });
  } catch (error) {
    console.error("Image search error:", error.message);

    return res.status(500).json({
      error: "Unable to search images right now",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Image search server running at http://localhost:${PORT}`);
  console.log("API key loaded:", Boolean(process.env.SERPAPI_API_KEY));
});
