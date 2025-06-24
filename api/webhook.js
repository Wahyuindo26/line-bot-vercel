import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

// 🔒 Admin ID
const admins = {
  pavinendra: 'pavinendra', // Ganti dengan ID asli Pavinendra
};

// 🧠 Game State
const playerQueue = [];
const playerCards = {};
const playerStatus = {};
const gameHistory = [];

let currentTurn = null;
let resetTimer = null;

const fullDeck = [
  '🂡','🂢','🂣','🂤','🂥','🂦','🂧','🂨','🂩','🂪','🂫','🂬','🂭',
  '🂱','🂲','🂳','🂴','🂵','🂶','🂷','🂸','🂹','🂺','🂻','🂼','🂽',
  '🃁','🃂','🃃','🃄','🃅','🃆','🃇','🃈','🃉','🃊','🃋','🃌','🃍'
];

// 🧮 Hitung total nilai kartu
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

await client.pushMessage(userId, {
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
            uri: 'https://line.me/R/ti/p/@552qvten' // Ganti dengan ID bot kamu
          },
          style: 'primary',
          color: '#00B900'
        }
      ]
    }
  }
});

// 🧾 Flex Message: Tampilkan hasil akhir
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
  if (!events || !Array.isArray(events)) return res.status(400).json({ error: 'Invalid format' });

  try {
    const results = await Promise.all(events.map(handleEvent));
    return res.status(200).json(results);
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const msg = event.message.text.trim().toLowerCase();
  const userId = event.source.userId;

  // === Command STAND ===
  if (msg === 'stand') {
    if (!playerQueue.includes(userId))
      return client.replyMessage(event.replyToken, { type: 'text', text: 'Kamu belum bergabung.' });

    if (userId !== currentTurn)
      return client.replyMessage(event.replyToken, { type: 'text', text: '⏳ Bukan giliranmu.' });

    playerStatus[userId] = 'stand';

    // Cari pemain lawan
    const [p1, p2] = playerQueue;
    const lawan = p1 === userId ? p2 : p1;

    if (['stand', 'bust'].includes(playerStatus[lawan])) {
      // Dua pemain selesai → kirim hasil akhir
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

    // Pindah giliran ke lawan
    currentTurn = lawan;
    await client.pushMessage(lawan, {
      type: 'text',
      text: '🎯 Giliranmu sekarang! Ketik "hit" atau "stand".',
    });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '✅ Kamu memilih "stand". Giliran berpindah.',
    });
  }
}
// === HIT ===
if (msg === 'hit') {
  if (!playerQueue.includes(userId)) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '🚫 Kamu belum bergabung.' });
  }

  if (userId !== currentTurn) {
    return client.replyMessage(event.replyToken, { type: 'text', text: '⏳ Ini bukan giliranmu.' });
  }

  const card = fullDeck[Math.floor(Math.random() * fullDeck.length)];
  playerCards[userId].push(card);
  const total = hitungNilai(playerCards[userId]);
  const kartu = playerCards[userId].join(' ');

  await client.pushMessage(userId, {
    type: 'text',
    text: `🂠 Kamu mendapat kartu: ${card}\n🧮 Totalmu: ${total}\n🃏 Kartu: ${kartu}`
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

// === GABUNG ===
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

  // Dua pemain lengkap → mulai game
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

// === MULAI ===
if (msg === 'mulai') {
  if (playerQueue.length > 0) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: 'Permainan sedang berlangsung. Tunggu ronde selanjutnya!'
    });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '🎉 Ketik "gabung" untuk mulai bermain Blackjack!'
  });
}

// === RIWAYAT ===
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

// === RESET RIWAYAT ===
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

// === DEFAULT ===
return client.replyMessage(event.replyToken, {
  type: 'text',
  text: 'Perintah tidak dikenal. Ketik "mulai", "gabung", "hit", atau "stand".'
});
