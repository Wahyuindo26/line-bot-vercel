import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

const admins = {
  pavinendra: 'pavinendra', // Ganti dengan userId LINE asli
};

const playerQueue = [];
const playerCards = {};
const playerStatus = {};
const gameHistory = [];

function hitungNilai(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    const val = card.replace(/[^\dAJQK]/gi, '');
    if (['J','Q','K'].includes(val)) total += 10;
    else if (val === 'A') { aces++; total += 11; }
    else total += parseInt(val) || 0;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

function buatFlexHasil(p1, p2, nama1, nama2) {
  const kartu1 = playerCards[p1] || [];
  const kartu2 = playerCards[p2] || [];
  const nilai1 = hitungNilai(kartu1);
  const nilai2 = hitungNilai(kartu2);

  let pemenang = '🤝 Seri!';
  if (nilai1 <= 21 && nilai2 <= 21) {
    if (nilai1 > nilai2) pemenang = `🎉 Pemenang: ${nama1}`;
    else if (nilai2 > nilai1) pemenang = `🎉 Pemenang: ${nama2}`;
  } else if (nilai1 <= 21) pemenang = `🎉 Pemenang: ${nama1}`;
  else if (nilai2 <= 21) pemenang = `🎉 Pemenang: ${nama2}`;
  else pemenang = `⚖️ Keduanya bust!`;

  return {
    type: 'flex',
    altText: 'Hasil Pertandingan Blackjack',
    contents: {
      type: 'carousel',
      contents: [
        {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: `${nama1}`, weight: 'bold', size: 'lg' },
              { type: 'text', text: `Kartu: ${kartu1.join(' ')}`, wrap: true },
              { type: 'text', text: `Total: ${nilai1}` }
            ]
          }
        },
        {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: `${nama2}`, weight: 'bold', size: 'lg' },
              { type: 'text', text: `Kartu: ${kartu2.join(' ')}`, wrap: true },
              { type: 'text', text: `Total: ${nilai2}` }
            ]
          }
        },
        {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: pemenang, weight: 'bold', size: 'lg', color: '#00C851', wrap: true }
            ]
          }
        }
      ]
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const events = req.body?.events;
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid format' });
  }

  try {
    const results = await Promise.all(events.map(handleEvent));
    return res.status(200).json(results);
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

if (event.type !== 'message' || event.message.type !== 'text') return;
const msg = event.message.text.trim().toLowerCase();
const userId = event.source.userId;

if (msg === 'mulai') {
  if (playerQueue.length > 0) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'Permainan sedang berlangsung. Tunggu ronde berikutnya!'
    });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '🎉 Welcome to CHL Blackjack Table\n'+
          'Let's Party and Game On\n\n'+
          'ⓘ Ketik .htp untuk cara bermain'+
          '🃏 Ketik gabung untuk ikut bermain\n'+
          '🔄 Ketik batal untuk keluar dari meja\n\n'+
          'May luck be on your side tonight. ♠',
  });
}
