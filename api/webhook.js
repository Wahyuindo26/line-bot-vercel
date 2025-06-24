import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

// 🧠 Variabel penyimpanan sementara pemain
const playerQueue = [];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const events = req.body?.events;
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid event format' });
  }

  try {
    const results = await Promise.all(events.map(handleEvent));
    return res.status(200).json(results);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 🎮 Handler pesan masuk
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;

  const msg = event.message.text.trim().toLowerCase();
  const userId = event.source.userId;

  // 🃏 Command 'gabung'
  if (msg === 'gabung') {
    if (playerQueue.includes(userId)) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Kamu sudah bergabung. Tunggu pemain lainnya...',
      });
    }

    playerQueue.push(userId);

    if (playerQueue.length < 2) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🃏 Kamu pemain pertama. Tunggu satu pemain lagi untuk memulai.',
      });
    }

    if (playerQueue.length === 2) {
      const startMessage = {
        type: 'text',
        text: '🎮 Permainan dimulai! Siapkan strategi dan keberuntunganmu.',
      };

      await Promise.all(
        playerQueue.map(uid => client.pushMessage(uid, startMessage))
      );

      // 💡 Lanjut ke pembagian kartu nanti di sini

      return;
    }

    // Lebih dari 2 pemain
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'Maaf, meja penuh. Tunggu ronde berikutnya 🙏',
    });
  }

  // ✉️ Default (pesan yang tidak dikenali)
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: 'Perintah tidak dikenal. Ketik "mulai" untuk melihat opsi.',
  });
}
