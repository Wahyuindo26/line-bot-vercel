import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

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
// 💬 Di sini kamu bisa tambah logika command seperti 'mulai'
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const msg = event.message.text.trim().toLowerCase();

  if (msg === 'mulai') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text:
        '🎉 Selamat datang di meja Blackjack LINE!\n' +
        'Di sini, keberuntungan dan strategi diuji.\n\n' +
        '🃏 Ketik "gabung" untuk ikut bermain\n' +
        '🔄 Ketik "batal" untuk keluar dari meja\n\n' +
        'Selamat bersenang-senang — giliranmu akan tiba!',
    });
  }

  // Default echo
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: `Kamu bilang: "${event.message.text}"`,
  });
}
