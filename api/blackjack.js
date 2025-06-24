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

 try {
    if (event.type !== 'message' || event.message.type !== 'text') return;

    const msg = event.message.text.trim().toLowerCase();
    const userId = event.source.userId;
  
    console.log(`[MSG] ${userId}: ${msg}`);
  
    if (msg === 'mulai') {
      if (playerQueue.length > 0) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: 'Permainan sedang berlangsung. Tunggu ronde selanjutnya!',
        });
      }
  
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text:
          '🎉 Welcome to CHL Blackjack Table\n' +
          "Let's Party and Game On\n\n" +
          'ⓘ Ketik .htp untuk cara bermain\n' +
          '🃏 Ketik gabung untuk ikut bermain\n' +
          '🔄 Ketik batal untuk keluar dari meja\n\n' +
          'May luck be on your side tonight. ♠',
      });
    }
    if (msg === 'gabung') {
      if (playerQueue.includes(userId)) {
        return client.replyMessage(event.replyToken, { type: 'text', text: 'Kamu sudah bergabung!' });
      }
  
      if (playerQueue.length >= 2) {
        return client.replyMessage(event.replyToken, { type: 'text', text: 'Meja penuh. Tunggu ronde berikutnya 🙏' });
      }
  
      playerQueue.push(userId);
      playerCards[userId] = [];
      playerStatus[userId] = 'playing';
  
      if (playerQueue.length === 1) {
        return client.replyMessage(event.replyToken, { type: 'text', text: '🃏 Kamu pemain pertama. Tunggu 1 lagi.' });
      }
  
      const [p1, p2] = playerQueue;
      const profile1 = await client.getProfile(p1);
      const profile2 = await client.getProfile(p2);
      gameHistory.push({
        players: [
          { id: p1, name: profile1.displayName },
          { id: p2, name: profile2.displayName }
        ],
        timestamp: new Date().toISOString(),
      });
  
      await Promise.all([
        client.pushMessage(p1, { type: 'text', text: '🎮 Permainan dimulai!' }),
        client.pushMessage(p2, { type: 'text', text: '🎮 Permainan dimulai!' }),
      ]);
  
      currentTurn = p1;
      await client.pushMessage(p1, {
        type: 'text',
        text: '🎯 Giliranmu sekarang! Ketik "hit" atau "stand".'
      });
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🃏 Permainan dimulai! Giliran pertama telah dipanggil.',
      });
      
  
      if (!resetTimer) {
        resetTimer = setTimeout(() => {
          playerQueue.length = 0;
          currentTurn = null;
          Object.keys(playerCards).forEach(k => delete playerCards[k]);
          Object.keys(playerStatus).forEach(k => delete playerStatus[k]);
        }, 2 * 60 * 1000);
      }
  
      return;
    }
  
    if (playerQueue.length === 2) {
      globalThis.currentDeck = shuffleDeck(fullDeck);
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🃏 Meja lengkap! Deck telah dikocok.',
      });    
    }
  
    if (msg === 'batal') {
      const index = playerQueue.indexOf(userId);
      if (index !== -1) {
        playerQueue.splice(index, 1);
        delete playerCards[userId];
        delete playerStatus[userId];
      }
  
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '✅ Kamu telah keluar dari meja.'
      });
    }
  
    if (msg === '.htp') {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text:
          '♠️ Cara Bermain CHL Blackjack\n\n' +
          '📌 Tujuan: capai total kartu sedekat mungkin ke 21 tanpa lebih!\n\n' +
          '🃏 Perintah:\n' +
          '- mulai → buka meja baru\n' +
          '- gabung → masuk ke permainan (maks. 2 pemain)\n' +
          '- hit → ambil kartu saat giliranmu\n' +
          '- stand → selesaikan giliranmu\n' +
          '- batal → keluar dari permainan\n' +
          '- riwayat → lihat permainan terakhir\n' +
          '- .htp → tampilkan panduan ini\n\n' +
          '💥 > 21 poin = bust = kalah otomatis\n🎯 Tunggu giliranmu dan main cerdas. Good luck!'
      });
    }
  
    if (msg === 'riwayat') {
      if (gameHistory.length === 0) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '📭 Belum ada riwayat permainan.'
        });
      }
  
      const latest = gameHistory[gameHistory.length - 1];
      const teks = latest.players.map((p, i) => `Pemain ${i + 1}: ${p.name}`).join('\n') +
        `\nTanggal: ${latest.timestamp}`;
  
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: `📜 Riwayat Terakhir:\n${teks}`
      });
    }
  
    if (msg === 'reset-riwayat') {
      if (userId !== admins.pavinendra) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '❌ Hanya admin yang bisa mereset riwayat.'
        });
      }
  
      gameHistory.length = 0;
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '✅ Riwayat telah direset oleh admin.'
      });
    }
    if (msg === 'hit') {
      if (!playerQueue.includes(userId)) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '🚫 Kamu belum bergabung.'
        });
      }
  
      if (userId !== currentTurn) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '⏳ Ini bukan giliranmu.'
        });
      }
  
      const card = globalThis.currentDeck?.shift() || '🃏'; // fallback jika deck kosong
      playerCards[userId].push(card);
      const total = hitungNilai(playerCards[userId]);
      const kartu = playerCards[userId].join(' ');
  
      await client.pushMessage(userId, {
        type: 'text',
        text: `🃏 Kamu mendapat kartu: ${card}\n🧮 Totalmu: ${total}\n📦 Kartu kamu: ${kartu}`
      });
  
      if (total > 21) {
        playerStatus[userId] = 'bust';
  
        const [p1, p2] = playerQueue;
        const lawan = p1 === userId ? p2 : p1;
        const profile1 = await client.getProfile(p1);
        const profile2 = await client.getProfile(p2);
        const hasilFlex = buatFlexHasil(p1, p2, profile1.displayName, profile2.displayName);
  
        await Promise.all([
          client.pushMessage(p1, hasilFlex),
          client.pushMessage(p2, hasilFlex),
        ]);         
  
        playerQueue.length = 0;
        currentTurn = null;
        resetTimer = null;
        Object.keys(playerCards).forEach(k => delete playerCards[k]);
        Object.keys(playerStatus).forEach(k => delete playerStatus[k]);
      }
  
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🎴 Kartu telah diberikan. Kamu bisa "hit" lagi atau "stand".'
      });
    }
  
    if (msg === 'stand') {
      if (!playerQueue.includes(userId)) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '🚫 Kamu belum bergabung.'
        });
      }
  
      if (userId !== currentTurn) {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '⏳ Bukan giliranmu.'
        });
      }
  
      playerStatus[userId] = 'stand';
  
      const [p1, p2] = playerQueue;
      const lawan = p1 === userId ? p2 : p1;
  
      if (['stand', 'bust'].includes(playerStatus[lawan])) {
        const profile1 = await client.getProfile(p1);
        const profile2 = await client.getProfile(p2);
        const hasilFlex = buatFlexHasil(p1, p2, profile1.displayName, profile2.displayName);
  
        await Promise.all([
          client.pushMessage(p1, hasilFlex),
          client.pushMessage(p2, hasilFlex),
        ]);
  
        playerQueue.length = 0;
        currentTurn = null;
        resetTimer = null;
        Object.keys(playerCards).forEach(k => delete playerCards[k]);
        Object.keys(playerStatus).forEach(k => delete playerStatus[k]);
  
        return;
      }
  
      currentTurn = lawan;
      await client.pushMessage(lawan, {
        type: 'text',
        text: '🎯 Giliranmu sekarang! Ketik "hit" atau "stand".'
      });
  
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '✅ Kamu memilih "stand". Giliran berpindah.'
      });
      
    }
  
    // === DEFAULT FALLBACK ===
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'Perintah tidak dikenal. Ketik "mulai", "gabung", "hit", atau "stand".'
    });
    
 }
 catch (err) {
    console.error('[ERROR in handleEvent]', err);
 }

  if (playerQueue.length === 2 && globalThis.currentDeck && !currentTurn) {
  currentTurn = playerQueue[0];
  await client.pushMessage(currentTurn, {
    type: 'text',
    text: '🎯 Giliranmu sekarang! Ketik "hit" atau "stand".'
  });

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '🕹️ Permainan aktif! Giliran pertama dimulai.',
  });
}

} // 🔚 Tutup fungsi handleEvent
