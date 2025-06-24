import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

const playerQueue = [];
const gameHistory = [];
const playerCards = {};
const playerStatus = {};
let currentTurn = null;
let resetTimer = null;

const fullDeck = [
  '🂡', '🂢', '🂣', '🂤', '🂥', '🂦', '🂧', '🂨', '🂩', '🂪', '🂫', '🂬', '🂭',
  '🂱', '🂲', '🂳', '🂴', '🂵', '🂶', '🂷', '🂸', '🂹', '🂺', '🂻', '🂼', '🂽',
  '🃁', '🃂', '🃃', '🃄', '🃅', '🃆', '🃇', '🃈', '🃉', '🃊', '🃋', '🃌', '🃍'
];

// Ganti dengan LINE userId milik Pavinendra
const admins = {
  pavinendra: 'Uabc123pavin456xyz',
};

function hitungNilai(cards) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    const value = card.replace(/[^\dAJQK]/gi, '');
    if (['J', 'Q', 'K'].includes(value)) total += 10;
    else if (value === 'A') {
      aces++;
      total += 11;
    } else {
      total += parseInt(value) || 0;
    }
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }

  return total;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const events = req.body?.events;
  if (!events || !Array.isArray(events)) return res.status(400).json({ error: 'Invalid event format' });

  try {
    const results = await Promise.all(events.map(handleEvent));
    return res.status(200).json(results);
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return;
  const msg = event.message.text.trim().toLowerCase();
  const userId = event.source.userId;

  const resetGame = () => {
    playerQueue.length = 0;
    currentTurn = null;
    resetTimer = null;
    Object.keys(playerCards).forEach(k => delete playerCards[k]);
    Object.keys(playerStatus).forEach(k => delete playerStatus[k]);
  };

  if (msg === 'mulai') {
    if (playerQueue.length > 0) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Permainan sedang berlangsung atau pemain sudah bergabung. Tunggu ronde berikutnya ya! 🎲',
      });
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text:
        '🎉 Welcome to CHL Blackjack Table\n' +
        "Let's Party and Game On\n\n" +
        '🃏 Ketik gabung untuk ikut bermain\n' +
        '🔄 Ketik batal untuk keluar dari meja\n\n' +
        'May luck be on your side tonight. ♠',
    });
  }

  if (msg === 'gabung') {
    if (playerQueue.includes(userId)) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Kamu sudah bergabung. Tunggu pemain lainnya...',
      });
    }

    if (playerQueue.length >= 2) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Maaf, meja penuh. Tunggu ronde berikutnya 🙏',
      });
    }

    playerQueue.push(userId);

    if (playerQueue.length < 2) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🃏 Kamu pemain pertama. Tunggu satu pemain lagi untuk memulai.',
      });
    }

    const [profile1, profile2] = await Promise.all([
      client.getProfile(playerQueue[0]),
      client.getProfile(playerQueue[1]),
    ]);

    gameHistory.push({
      players: [
        { id: playerQueue[0], name: profile1.displayName },
        { id: playerQueue[1], name: profile2.displayName },
      ],
      timestamp: new Date().toISOString(),
    });

    playerCards[playerQueue[0]] = [];
    playerCards[playerQueue[1]] = [];
    playerStatus[playerQueue[0]] = 'playing';
    playerStatus[playerQueue[1]] = 'playing';

    const startMessage = {
      type: 'text',
      text: '🎮 Permainan dimulai! Siapkan strategi dan keberuntunganmu.',
    };

    await Promise.all(playerQueue.map(uid => client.pushMessage(uid, startMessage)));

    currentTurn = playerQueue[0];
    await client.pushMessage(currentTurn, {
      type: 'text',
      text: '🎯 Giliranmu sekarang! Ketik "hit" untuk ambil kartu atau "stand" jika cukup.',
    });

    if (!resetTimer) resetTimer = setTimeout(resetGame, 2 * 60 * 1000);
    return;
  }

  if (msg === 'batal') {
    const index = playerQueue.indexOf(userId);
    if (index === -1) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Kamu belum bergabung, tidak ada yang perlu dibatalkan 😅',
      });
    }

    playerQueue.splice(index, 1);
    delete playerCards[userId];
    delete playerStatus[userId];
    if (playerQueue.length === 0 && resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
      currentTurn = null;
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '✅ Kamu telah keluar dari meja Blackjack. Sampai jumpa lagi!',
    });
  }

  if (msg === 'hit') {
    if (!playerQueue.includes(userId))
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🚫 Kamu belum bergabung dalam permainan.',
      });

    if (userId !== currentTurn)
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '⏳ Ini bukan giliranmu. Tunggu giliranmu ya!',
      });

    const card = fullDeck[Math.floor(Math.random() * fullDeck.length)];
    playerCards[userId].push(card);

    const total = hitungNilai(playerCards[userId]);
    const kartu = playerCards[userId].join(' ');

    await client.pushMessage(userId, {
      type: 'text',
      text: `🂠 Kamu mendapat kartu: ${card}\n🧮 Totalmu: ${total}\n🃏 Kartu kamu: ${kartu}`,
    });

    if (total > 21) {
      playerStatus[userId] = 'bust';

      await client.pushMessage(userId, { type: 'text', text: `💥 Kamu bust! Poinmu melebihi 21.` });

      const other = playerQueue.find(uid => uid !== userId);
      await client.pushMessage(other, { type: 'text', text: `🎉 Lawan kamu bust! Kamu menang otomatis.` });

      resetGame();
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '🎴 Kartu diberikan. Kamu bisa "hit" lagi atau "stand".',
    });
  }

  if (msg === 'stand') {
    if (!playerQueue.includes(userId))
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '🚫 Kamu belum bergabung dalam permainan.',
      });

    if (userId !== currentTurn)
