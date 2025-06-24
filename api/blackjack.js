import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

const admins = { pavinendra: 'pavinendra' };
const playerQueue = [];
const playerCards = {};
const playerStatus = {};
const gameHistory = [];
let currentTurn = null;
let resetTimer = null;

const suits = ['♠️', '♥️', '♣️', '♦️'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const fullDeck = [];

for (const suit of suits) {
  for (const value of values) {
    fullDeck.push(`${value}${suit}`);
  }
}

function shuffleDeck(deck) {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

function hitungNilai(cards) {
    let total = 0;
    let aceCount = 0;
    for (const card of cards) {
      const value = card.slice(0, card.length - 2); // 'A', '10', 'K', dsb
  
      if (value === 'A') {
        total += 11;
        aceCount++;
      } else if (['J', 'Q', 'K'].includes(value)) {
        total += 10;
      } else {
        total += parseInt(value, 10);
      }
    }
  
    while (total > 21 && aceCount > 0) {
      total -= 10;
      aceCount--;
    }
  
    return total;
  }

function buatFlexHasil(p1, p2, nama1, nama2) {
  return {
    type: 'flex',
    altText: 'Hasil Permainan',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: '🎉 Hasil Permainan', weight: 'bold', size: 'xl' }]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: `${nama1} vs ${nama2}`, wrap: true, weight: 'bold', size: 'md' },
          { type: 'text', text: 'Pemenang: TBD', wrap: true, size: 'sm' }
        ]
      }
    }
  };
}

async function ajakTambahTeman(userId) {
  return client.pushMessage(userId, {
    type: 'flex',
    altText: 'Tambahkan Bot Dulu',
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: '👋 Tambahkan Bot Ini Dulu', weight: 'bold', size: 'xl' }]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: 'Agar kamu bisa menerima kartu secara privat, tambahkan bot ini ke daftar teman kamu di LINE.', wrap: true },
          {
            type: 'button',
            action: {
              type: 'uri',
              label: 'Tambah Sekarang',
              uri: 'https://line.me/R/ti/p/@552qvten'
            },
            style: 'primary',
            color: '#00B900'
          }
        ]
      }
    }
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  console.log('[DEBUG] Webhook triggered:', JSON.stringify(req.body));

  const events = req.body?.events;
  if (!Array.isArray(events)) {
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

async function handleEvent(event) {
  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '✅ Webhook aktif dan bot menjawab',
  });
}
