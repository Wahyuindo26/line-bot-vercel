import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

// Konfigurasi agar Vercel mem-parsing body JSON
export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const events = req.body?.events;

  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid event format' });
  }

  try {
    const results = await Promise.all(
      events.map((event) => {
        if (event.type !== 'message' || event.message.type !== 'text') return;
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `Kamu bilang: "${event.message.text}"`,
        });
      })
    );
    return res.status(200).json(results);
  } catch (error) {
    console.error('LINE reply failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
