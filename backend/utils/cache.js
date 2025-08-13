const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const getCachedResponse = async (userId, type) => {
  const { data } = await supabase
    .from("cache")
    .select("*")
    .eq("user_id", userId)
    .eq("type", type)
    .single();
  return data ? data.response : null;
};

const setCachedResponse = async (userId, type, response) => {
  await supabase
    .from("cache")
    .upsert({ user_id: userId, type, response, updated_at: new Date() });
};

module.exports = { getCachedResponse, setCachedResponse };