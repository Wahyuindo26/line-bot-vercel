import { Client } from '@line/bot-sdk';

const client = new Client({
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
});

export const config = {
  api: { bodyParser: true },
};

const admins = {
  pavinendra: 'Ud5a0a393d90b60e1ed170f31422ff11d' // Ganti ini dengan ID asli kamu
};
const botLawanId = 'bot-lawan';
const userActivity = {}; // Track user seen & message timestamp
const playerQueue = [];
const playerCards = {};
const playerStatus = {};
const gameHistory = [];

let currentTurn = null;
let resetTimer = null;
let turnTimeout = null;

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
    const value = card.slice(0, card.length - 2);

    if (!value) {
      console.error(`[ERROR] Kartu tidak valid ditemukan: ${card}`);
      continue;
    }

    if (value === 'A') {
      total += 11;
      aceCount++;
    } else if (['J', 'Q', 'K'].includes(value)) {
      total += 10;
    } else {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        console.error(`[ERROR] Nilai tidak dikenali: ${card}`);
        continue;
      }
      total += parsed;
    }
  }

  while (total > 21 && aceCount > 0) {
    total -= 10;
    aceCount--;
  }

  return total;
}

function buatFlexHasil(p1, p2, nama1, nama2) {
    const cards1 = playerCards[p1] || [];
    const cards2 = playerCards[p2] || [];
  
    const total1 = hitungNilai(cards1);
    const total2 = hitungNilai(cards2);
  
    const isBust1 = total1 > 21;
    const isBust2 = total2 > 21;
  
    let pemenang = 'Seri 🤝';
  
    if (isBust1 && !isBust2) {
      pemenang = `${nama2} menang 🏆`;
    } else if (!isBust1 && isBust2) {
      pemenang = `${nama1} menang 🏆`;
    } else if (!isBust1 && !isBust2) {
      if (total1 > total2) {
        pemenang = `${nama1} menang 🏆`;
      } else if (total2 > total1) {
        pemenang = `${nama2} menang 🏆`;
      }
    }
  
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
            { type: 'text', text: `Pemenang: ${pemenang}`, wrap: true, size: 'sm' },
            { type: 'separator', margin: 'md' },
            { type: 'text', text: `${nama1}: ${cards1.join(' ')} (${total1})`, wrap: true, size: 'sm' },
            { type: 'text', text: `${nama2}: ${cards2.join(' ')} (${total2})`, wrap: true, size: 'sm' }
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

      // 🕵️ Track user activity
      const now = Date.now();
      userActivity[userId] = userActivity[userId] || {};
      userActivity[userId].lastSeen = now;

      if (event.type === 'message' && event.message.type === 'text') {
        userActivity[userId].lastMessage = now;
      }


      if (event.type !== 'message' || event.message.type !== 'text') return;
  
      const msg = event.message.text.trim().toLowerCase();
      const userId = event.source.userId;
      const groupId = event.source.type === 'group' ? event.source.groupId : null;
  
      console.log('[ADMIN DEBUG] userId:', userId);
      console.log(`[MSG] ${userId}: ${msg}`);
  
      if (msg === '/mulai') {
        if (playerQueue.length > 0) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Permainan sedang berlangsung. Tunggu ronde selanjutnya!'
          });
        }
  
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text:
            '♠ CHL Blackjack Table ♠\n' +
            "Let's Party and Game On\n\n" +
            '💡 /htp : cara bermain\n' +
            '🃏 /gabung : ikut bermain\n' +
            '🔄 /batal : keluar dari meja\n\n' +
            'add bot untuk bermain',
        });
      }
  
      if (msg === '/gabung') {
        if (playerQueue.includes(userId)) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Kamu sudah bergabung!'
          });
        }
  
        if (playerQueue.length >= 2) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Meja penuh. Tunggu ronde berikutnya 🙏'
          });
        }
  
        playerQueue.push(userId);
        playerCards[userId] = [];
        playerStatus[userId] = 'playing';
  
        if (playerQueue.length === 1) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '🃏 Kamu pemain pertama. Tunggu 1 lagi.'
          });
        }
  
        // Jika sudah ada dua pemain
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
  
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '🃏 Kamu adalah pemain kedua. Permainan akan dimulai!'
        });
  
        // 🔄 Reset paksa jika game tergantung
        if (playerQueue.length === 2 && (globalThis.currentDeck || currentTurn)) {
          console.log('[WARN] Terdeteksi status menggantung. Reset paksa.');
          resetGameState();
        }
  
        // Mulai giliran
        await mulaiGiliranPertama(groupId ?? userId);
        return;
      }
  
      if (msg === '/vsbot') {
        if (playerQueue.length !== 1) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Untuk main vs bot, kamu harus jadi satu-satunya pemain di meja.'
          });
        }
  
        playerQueue.push(botLawanId);
        playerCards[botLawanId] = [];
        playerStatus[botLawanId] = 'playing';
  
        await client.replyMessage(event.replyToken, {
          type: 'text',
          text: '🤖 Bot telah masuk ke meja sebagai lawanmu!'
        });
  
        // Reset paksa jika status menggantung
        if (globalThis.currentDeck || currentTurn) {
          console.log('[VSBOT] Reset karena status tidak bersih');
          resetGameState();
        }
  
        await mulaiGiliranPertama(groupId ?? userId);
        return;
      }

      if (msg === '/batal') {
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
  
      if (msg === '/hit') {
        if (!playerCards[userId]) playerCards[userId] = [];
  
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
  
        if (!globalThis.currentDeck || globalThis.currentDeck.length === 0) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ Deck habis atau belum dikocok. Permainan tidak bisa lanjut.'
          });
        }
  
        const semuaSudahSelesai = playerQueue.every(pid =>
          ['stand', 'bust'].includes(playerStatus[pid])
        );
        if (semuaSudahSelesai) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: 'Permainan telah selesai'
          });
        }
  
        const card = ambilKartu();
        if (!card) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ Deck kosong. Permainan tidak bisa lanjut.'
          });
        }
  
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
  
          if (groupId) {
            await client.pushMessage(groupId, hasilFlex);
          } else {
            await Promise.all([
              client.pushMessage(p1, hasilFlex),
              client.pushMessage(p2, hasilFlex)
            ]);
          }
  
          await client.pushMessage(p1, { type: 'text', text: '🎮 Ronde telah selesai. /gabung untuk main lagi.' });
          await client.pushMessage(p2, { type: 'text', text: '🎮 Ronde telah selesai. /gabung untuk main lagi.' });
  
          resetGameState();
          console.log('[RESET] Game reset setelah bust');
        } else {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '🎴 Kartu telah diberikan. Kamu bisa "/hit" lagi atau "/stand".'
          });
        }
      }

      if (msg === '/stand') {
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
  
          if (groupId) {
            await client.pushMessage(groupId, hasilFlex);
          } else {
            await Promise.all([
              client.pushMessage(p1, hasilFlex),
              client.pushMessage(p2, hasilFlex)
            ]);
          }
  
          resetGameState();
          console.log('[RESET] Game reset setelah kedua pemain selesai');
          return;
        } else {
          // lanjutkan giliran ke lawan
          currentTurn = lawan;
          playerStatus[currentTurn] = 'playing';
  
          await client.pushMessage(currentTurn, {
            type: 'text',
            text: '🎯 Giliranmu sekarang! Ketik "/hit" atau "/stand".'
          });
  
          aturTimeoutGiliran(groupId, currentTurn);
        }
  
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '✅ Kamu memilih "stand". Giliran berpindah.'
        });
      }
  
      if (msg === '/htp') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text:
            '♠️ Cara Bermain CHL Blackjack\n\n' +
            '📌 Tujuan: capai total kartu sedekat mungkin ke 21 tanpa lebih!\n\n' +
            '🃏 Perintah:\n' +
            '- /mulai → buka meja baru\n' +
            '- /gabung → masuk ke permainan (maks. 2 pemain)\n' +
            '- /hit → ambil kartu saat giliranmu\n' +
            '- /stand → selesaikan giliranmu\n' +
            '- /batal → keluar dari permainan\n' +
            '- /riwayat → lihat permainan terakhir\n' +
            '- /htp → tampilkan panduan ini\n\n' +
            '💥 > 21 poin = bust = kalah otomatis\n🎯 Tunggu giliranmu dan main cerdas. Good luck!'
        });
      }
  
      if (msg === '/riwayat') {
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
  
      if (msg === '/reset-riwayat') {
        if (userId !== admins.pavinendra) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '❌ Hanya admin yang bisa mereset riwayat.'
          });
        }
  
        gameHistory.length = 0;
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: '✅ As you wish my lord 🙇'
        });
      }

      if (msg === '/sider') {
        const replyContext = event.message?.replyToken && event.message?.replyTo;
      
        if (!replyContext || !replyContext.message || !replyContext.message.id) {
          return client.replyMessage(event.replyToken, {
            type: 'text',
            text: '⚠️ Gunakan perintah ini sebagai *balasan* (reply) ke pesanmu sebelumnya.'
          });
        }
      
        const checkSince = Date.now() - 5 * 60 * 1000; // 5 menit ke belakang
      
        const sidernya = Object.entries(userActivity)
          .filter(([uid, act]) =>
            uid !== userId &&
            act.lastSeen && act.lastSeen > checkSince &&
            (!act.lastMessage || act.lastMessage < checkSince)
          )
          .map(([uid]) => `• ${uid.slice(0, 10)}...`);
      
        const response = sidernya.length
          ? `👀 Yang terlihat membaca tapi belum merespons:\n${sidernya.join('\n')}`
          : '✅ Tidak ada “sider” terdeteksi dalam 5 menit terakhir.';
      
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: response
        });
      }
      
  
      if (msg === '/admin-id') {
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `🆔 ID kamu: ${userId}`
        });
      }
  
      // Abaikan pesan biasa
      if (!msg.startsWith('/')) return;
      return;
    } catch (err) {
      console.error('[ERROR in handleEvent]', err);
    }
  }

  async function mulaiGiliranPertama(groupId) {
    if (globalThis.currentDeck || currentTurn) {
      console.warn('[WARN] Auto-reset karena kondisi tak bersih');
      resetGameState();
    }
  
    if (playerQueue.length === 2 && !globalThis.currentDeck && !currentTurn) {
      globalThis.currentDeck = shuffleDeck(fullDeck);
      currentTurn = playerQueue[0];
  
      const profile = await client.getProfile(currentTurn);
  
      const giliranMsg = {
        type: 'text',
        text: `🎯 Giliran ${profile.displayName} sekarang! Ketik "/hit" atau "/stand".`
      };
  
      if (groupId) {
        await client.pushMessage(groupId, giliranMsg);
      } else {
        await Promise.all(playerQueue.map(uid => client.pushMessage(uid, giliranMsg)));
      }
  
      if (currentTurn === botLawanId) {
        setTimeout(() => {
          mainkanGiliranBot(groupId);
        }, 1500);
      }
  
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
        console.log('[TIMER] resetTimer dibatalkan karena game dimulai');
      }
  
      console.log('[DEBUG] Memulai giliran pertama', {
        p1: playerQueue[0],
        p2: playerQueue[1],
        currentTurn
      });
  
      console.log('[CHECK] State saat mulai:', {
        deck: !!globalThis.currentDeck,
        turn: currentTurn,
        q: playerQueue.length,
        p1: playerStatus[playerQueue[0]],
        p2: playerStatus[playerQueue[1]]
      });
  
      if (!groupId) {
        console.warn('[WARN] groupId undefined saat mulai giliran pertama');
      }
    }
  }
  
  async function mainkanGiliranBot(groupId) {
    if (!globalThis.currentDeck || !playerQueue.includes(botLawanId)) {
      console.warn('[BOT] Tidak bisa mulai giliran bot: state belum lengkap');
      return;
    }
  
    const total = hitungNilai(playerCards[botLawanId]);
  
    if (total < 17) {
      const card = ambilKartu();
      if (!card) {
        console.warn('[BOT] Deck kosong saat giliran bot.');
        return;
      }
      playerCards[botLawanId].push(card);
      const newTotal = hitungNilai(playerCards[botLawanId]);
  
      console.log(`[BOT] Bot hit: ${card}, total: ${newTotal}`);
  
      if (newTotal > 21) {
        playerStatus[botLawanId] = 'bust';
      }
    } else {
      playerStatus[botLawanId] = 'stand';
    }
  
    const playerId = playerQueue.find(p => p !== botLawanId);
    playerStatus[playerId] = playerStatus[playerId] || 'playing';
  
    if (
      ['stand', 'bust'].includes(playerStatus[playerId]) &&
      ['stand', 'bust'].includes(playerStatus[botLawanId])
    ) {
      const profile1 = await client.getProfile(playerId);
      const hasilFlex = buatFlexHasil(playerId, botLawanId, profile1.displayName, 'Bot');
  
      if (groupId) {
        await client.pushMessage(groupId, hasilFlex);
      } else {
        await client.pushMessage(playerId, hasilFlex);
      }
  
      await client.pushMessage(playerId, {
        type: 'text',
        text: '🎮 Ronde selesai. /gabung untuk main lagi.'
      });
      resetGameState();
      console.log('[RESET] Game selesai setelah giliran bot');
      return;
    }
  
    currentTurn = playerId;
    playerStatus[currentTurn] = 'playing';
    await client.pushMessage(currentTurn, {
      type: 'text',
      text: '🎯 Giliranmu sekarang!'
    });
    if (groupId) {
      aturTimeoutGiliran(groupId, currentTurn);
    } else {
      console.warn('[BOT] Bot tidak bisa set timeout: groupId null');
    }
  }

  function aturTimeoutGiliran(groupId, pemainAFK) {
    if (turnTimeout) clearTimeout(turnTimeout);
  
    turnTimeout = setTimeout(async () => {
      const [p1, p2] = playerQueue;
      const lawan = p1 === pemainAFK ? p2 : p1;
  
      const profileAFK = await client.getProfile(pemainAFK);
      const profileLawan = await client.getProfile(lawan);
  
      await client.pushMessage(groupId, {
        type: 'text',
        text: `⏱️ ${profileAFK.displayName} tidak melakukan aksi selama 5 menit.\nPermainan dihentikan. ${profileLawan.displayName} dinyatakan menang otomatis 🏆`
      });
  
      const hasilFlex = buatFlexHasil(p1, p2, profileAFK.displayName, profileLawan.displayName);
      await client.pushMessage(groupId, hasilFlex);
  
      resetGameState();
      console.log('[RESET] semua variabel dibersihkan');
      clearTimeout(turnTimeout);
      turnTimeout = null;
    }, 5 * 60 * 1000); // 5 menit
  }
  
  function ambilKartu() {
    if (!globalThis.currentDeck || globalThis.currentDeck.length === 0) {
      console.warn('[DECK] Deck kosong saat ambil kartu!');
      return null;
    }
    return globalThis.currentDeck.shift();
  }
  
  function resetGameState() {
    playerQueue.length = 0;
    currentTurn = null;
    resetTimer = null;
    clearTimeout(turnTimeout);
    turnTimeout = null;
    globalThis.currentDeck = null;
    Object.keys(playerCards).forEach(k => delete playerCards[k]);
    Object.keys(playerStatus).forEach(k => delete playerStatus[k]);
  
    console.log('[RESET] semua variabel dibersihkan');
    console.log('[TURN] Giliran berpindah ke:', currentTurn);
    console.log('[DEBUG] Game reset. playerQueue:', playerQueue, 
                'currentTurn:', currentTurn,
                'deck:', globalThis.currentDeck?.length ?? 'null');
    console.log('[CHECK] State saat mulai:', {
      deck: !!globalThis.currentDeck,
      turn: currentTurn,
      q: playerQueue.length,
      p1: playerStatus[playerQueue[0]],
      p2: playerStatus[playerQueue[1]]
    });
  }
