const axios = require("axios");

const openRouterCall = async (model, prompt) => {
  try {
    const res = await axios.post(
      `${process.env.OPENROUTER_API_URL}/chat/completions`,
      {
        model,
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return res.data.choices[0].message.content;
  } catch (err) {
    console.error("OpenRouter API error:", err.message);
    return null;
  }
};

module.exports = { openRouterCall };