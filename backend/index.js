import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import fetch from "node-fetch";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------- DAILY PLAN ----------
app.get("/daily-plan/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const today = new Date().toISOString().split("T")[0];

    // Check cache
    const { data: cached } = await supabase
      .from("daily_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("date", today)
      .single();

    if (cached) {
      return res.json({ source: "cache", data: cached.plan });
    }

    // Call GPT
    const prompt = `Create a personalized daily health plan for ${userId} with meals, workouts, hydration tips.`;
    const aiRes = await fetch(`${process.env.OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL_GPT4O,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const aiData = await aiRes.json();
    const plan = aiData.choices[0].message.content;

    // Store in cache
    await supabase.from("daily_plans").insert([{ user_id: userId, date: today, plan }]);

    res.json({ source: "api", data: plan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate daily plan" });
  }
});

// ---------- WEEKLY SUMMARY ----------
app.get("/weekly-summary/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const weekKey = `${new Date().getFullYear()}-W${getWeekNumber(new Date())}`;

    // Check cache
    const { data: cached } = await supabase
      .from("weekly_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("week_key", weekKey)
      .single();

    if (cached) {
      return res.json({ source: "cache", data: cached.summary });
    }

    // Call GPT
    const prompt = `Create a one-week health summary and improvement tips for ${userId}.`;
    const aiRes = await fetch(`${process.env.OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL_GPT4O,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const aiData = await aiRes.json();
    const summary = aiData.choices[0].message.content;

    // Store in cache
    await supabase.from("weekly_summaries").insert([{ user_id: userId, week_key: weekKey, summary }]);

    res.json({ source: "api", data: summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate weekly summary" });
  }
});

function getWeekNumber(date) {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date - firstDay) / (24 * 60 * 60 * 1000));
  return Math.ceil((date.getDay() + 1 + days) / 7);
}

// ---------- IMAGE ANALYSIS ----------
const upload = multer({ storage: multer.memoryStorage() });
app.post("/image-analysis", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    // Convert image buffer to base64
    const base64Image = req.file.buffer.toString("base64");

    // Call GPT for image analysis
    const aiRes = await fetch(`${process.env.OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL_GPT4O,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this health-related image and give advice." },
              { type: "image_url", image_url: `data:image/jpeg;base64,${base64Image}` }
            ]
          }
        ]
      }),
    });

    const aiData = await aiRes.json();
    const analysis = aiData.choices[0].message.content;
    res.json({ analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

// ---------- CHAT ENDPOINT ----------
app.post("/chat/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message required" });

    // Get chat history
    const { data: history } = await supabase
      .from("chat_history")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    // Prepare conversation
    const messages = history ? history.map(h => ({ role: h.role, content: h.content })) : [];
    messages.push({ role: "user", content: message });

    // Call GPT
    const aiRes = await fetch(`${process.env.OPENROUTER_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.MODEL_GPT4O,
        messages
      }),
    });
    const aiData = await aiRes.json();
    const reply = aiData.choices[0].message.content;

    // Save new messages
    await supabase.from("chat_history").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: reply }
    ]);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Chat failed" });
  }
});

// ---------- ROOT ----------
app.get("/", (req, res) => res.send("Health PWA Backend Running"));

app.listen(port, () => console.log(`Server running on port ${port}`));