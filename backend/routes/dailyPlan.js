const express = require("express");
const router = express.Router();
const { openRouterCall } = require("../utils/openRouter");
const { getCachedResponse, setCachedResponse } = require("../utils/cache");

router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  const today = new Date().toISOString().split("T")[0];
  
  // Try cache first
  const cached = await getCachedResponse(userId, `daily-${today}`);
  if (cached) return res.json({ source: "cache", data: cached });

  // Fetch from GPT-4o mini
  const prompt = `Generate a personalized daily health plan for user ${userId} including workouts, meals, and hydration tips.`;
  const result = await openRouterCall(process.env.MODEL_GPT4O, prompt);

  if (result) {
    await setCachedResponse(userId, `daily-${today}`, result);
    res.json({ source: "api", data: result });
  } else {
    res.status(500).json({ error: "Failed to fetch daily plan" });
  }
});

module.exports = router;