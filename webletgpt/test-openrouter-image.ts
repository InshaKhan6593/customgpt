import * as dotenv from "dotenv"
dotenv.config()

async function testImage() {
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
  if (!OPENROUTER_API_KEY) {
    console.log("No key")
    return
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "WebletGPT Test"
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: "Generate a picture of a cute red panda" }],
    })
  });

  const data = await response.json()
  console.log(JSON.stringify(data, null, 2))
}

testImage()
