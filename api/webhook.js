import { middleware, Client } from "@line/bot-sdk";

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new Client(config);

export const configRuntime = { runtime: "edge" }; // Tambahan untuk performa (opsional)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const body = await req.json();
  const events = body.events;

  const results = await Promise.all(events.map((event) => {
    if (event.type !== "message" || event.message.type !== "text") return;
    return client.replyMessage(event.replyToken, {
      type: "text",
      text: `Halo, kamu kirim: "${event.message.text}"`,
    });
  }));

  return res.status(200).json(results);
}