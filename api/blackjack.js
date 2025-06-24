import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  console.log('[🌀 START] Incoming request');

  if (req.method !== 'POST') {
    console.log('[⛔] Method not allowed:', req.method);
    return res.status(405).send('Method Not Allowed');
  }

  console.log('[✅] Valid POST received');
  console.log('[📨] Raw body:', JSON.stringify(req.body, null, 2));

  const events = req.body?.events;

  if (!Array.isArray(events)) {
    console.log('[❌] Invalid event format');
    return res.status(400).json({ error: 'Invalid format' });
  }

  try {
    const results = await Promise.all(events.map(async (event, index) => {
      console.log(`\n[🔔 EVENT ${index + 1}] Type: ${event.type}`);
      console.log('[👤] Source:', JSON.stringify(event.source));
      console.log('[🧾] Message:', JSON.stringify(event.message));
      console.log('[🎯] ReplyToken:', event.replyToken);

      if (event.type === 'message' && event.message.type === 'text') {
        try {
          const text = `✅ Bot aktif! Kamu kirim: "${event.message.text}"`;
          console.log('[📤] Sending reply message:', text);
          const response = await client.replyMessage(event.replyToken, {
            type: 'text',
            text,
          });
          console.log('[✅] ReplyMessage sent:', response);
          return response;
        } catch (err) {
          console.error('[🔥 REPLY ERROR]', err?.originalError?.response?.data || err.message || err);
        }
      } else {
        console.log('[ℹ️] Event bukan message teks → diabaikan');
      }
    }));

    console.log('[🏁 DONE] All events processed');
    return res.status(200).json(results);
  } catch (err) {
    console.error('[💥 HANDLER ERROR]', err);
    return res.status(500).json({ error: 'Unhandled server error' });
  }
}
