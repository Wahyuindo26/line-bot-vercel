
import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const events = req.body?.events;
  if (!Array.isArray(events)) return res.status(400).json({ error: 'Invalid format' });

  try {
    const results = await Promise.all(events.map(async (event) => {
      console.log('[TEST] Received event:', event);

      // Hanya balas pesan teks
      if (event.type === 'message' && event.message.type === 'text') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `✅ Bot aktif! Kamu kirim: "${event.message.text}"`,
        });
      }
    }));

    return res.status(200).json(results);
  } catch (err) {
    console.error('[TEST ERROR]', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
}
