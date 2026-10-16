const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ---------- SETTINGS ----------
const TILE = 32;
const SPEED = 4;
const LIVES = 3;             // runners share 3 lives; each catch costs 1
const RESPAWN_MS = 3000;     // caught runner comes back after 3 seconds
const SHIELD_MS = 2000;      // runners are protected for 2 seconds after spawning
const TICK_MS = 30;          // game updates about 33 times per second
const CATCH_DIST = 20;       // pixels between centers to count as a catch
const MAX_PLAYERS = 8;

// ---------- MAP ----------
// # = wall    . = dot    (space) = empty path
const MAP = [
  "####################",
  "#........##........#",
  "#.##.###.##.###.##.#",
  "#..................#",
  "#.##.#.######.#.##.#",
  "#....#....##....#..#",
  "#.##.#...##...#.##.#",
  "#.##.#.#....#.#.##.#",
  "#..................#",
  "#.##.#.######.#.##.#",
  "#....#....##....#..#",
  "#.##.#...##...#.##.#",
  "#.##.###.##.###.##.#",
  "#..................#",
  "####################"
];
const ROWS = MAP.length;
const COLS = MAP[0].length;

const HUNTER_SPAWN = { col: 9, row: 3 };                 // top of the map
const RUNNER_SPAWNS = [                                   // bottom of the map
  { col: 2, row: 13 }, { col: 9, row: 13 }, { col: 17, row: 13 },
  { col: 5, row: 13 }, { col: 13, row: 13 }
];

function isWall(col, row) {
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return true;
  return MAP[row][col] === '#';
}

function canMove(x, y) {
  const pad = 6;
  const left = Math.floor((x + pad) / TILE);
  const right = Math.floor((x + TILE - pad - 1) / TILE);
  const top = Math.floor((y + pad) / TILE);
  const bottom = Math.floor((y + TILE - pad - 1) / TILE);
  for (let r = top; r <= bottom; r++) {
    for (let c = left; c <= right; c++) {
      if (isWall(c, r)) return false;
    }
  }
  return true;
}

function placeAt(p, spawn) {
  p.x = spawn.col * TILE;
  p.y = spawn.row * TILE;
  p.want = null;                     // direction the player is asking for
  p.cur = { dx: 0, dy: 0 };          // direction the player is actually moving
}

function isFree(col, row) {
  return !isWall(col, row);
}

// Grid movement: players stay lined up on tiles and only turn or stop
// at the center of a tile, so they can never end up inside a wall.
// Moves the player SPEED pixels per tick, one pixel at a time.
// Stepping 1px at a time means every tile center is reached exactly,
// so turns happen immediately at any speed (even 5, which doesn't divide 32).
function stepPlayer(p) {
  for (let i = 0; i < SPEED; i++) stepOne(p);
}

function stepOne(p) {
  // Fix for players stuck between tiles with no direction: snap them to the nearest center
  if (!(p.x % TILE === 0 && p.y % TILE === 0) && !p.cur.dx && !p.cur.dy) {
    p.x = Math.round(p.x / TILE) * TILE;
    p.y = Math.round(p.y / TILE) * TILE;
  }

  const atCenter = p.x % TILE === 0 && p.y % TILE === 0;
  const col = p.x / TILE;
  const row = p.y / TILE;

  if (atCenter) {
    if (p.want && isFree(col + p.want.dx, row + p.want.dy)) {
      p.cur = { dx: p.want.dx, dy: p.want.dy };        // turn or keep going
    } else if (!p.want || !isFree(col + p.cur.dx, row + p.cur.dy)) {
      p.cur = { dx: 0, dy: 0 };                        // key released or wall ahead
    }
  } else if (p.want && (p.cur.dx || p.cur.dy) &&
             p.cur.dx === -p.want.dx && p.cur.dy === -p.want.dy) {
    p.cur = { dx: p.want.dx, dy: p.want.dy };          // turning back mid-tile is allowed
  }

  const prevX = p.x;
  const prevY = p.y;
  p.x += p.cur.dx;
  p.y += p.cur.dy;

  // Safety net: a player must always stay inside the border and never on a wall tile.
  // If a move would break that, cancel it and stop the player.
  const newCol = Math.floor((p.x + TILE / 2) / TILE);
  const newRow = Math.floor((p.y + TILE / 2) / TILE);
  const outside = p.x < TILE || p.y < TILE ||
                  p.x > (COLS - 2) * TILE || p.y > (ROWS - 2) * TILE;
  if (outside || isWall(newCol, newRow)) {
    p.x = prevX;
    p.y = prevY;
    p.cur = { dx: 0, dy: 0 };
  }
}

function clearDot(room, col, row) {
  if (room.dots[row] && room.dots[row][col]) room.dots[row][col] = false;
}

// ---------- ROOMS ----------
const rooms = {};

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms[code]);
  return code;
}

function cleanName(n) {
  return String(n || '').trim().slice(0, 12);
}

function getRoom(socket) {
  const code = socket.data.roomCode;
  return code ? rooms[code] : null;
}

function addPlayer(room, socket, name) {
  room.players.set(socket.id, {
    id: socket.id, name, role: 'Runner',
    x: 0, y: 0, want: null, cur: { dx: 0, dy: 0 }, alive: true, respawnAt: 0, protectedUntil: 0
  });
  socket.join(room.code);
  socket.data.roomCode = room.code;
}

function lobbyInfo(room) {
  return {
    code: room.code,
    owner: room.owner,
    state: room.state,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, role: p.role }))
  };
}

function broadcastLobby(room) {
  io.to(room.code).emit('lobbyUpdate', lobbyInfo(room));
}

// ---------- GAME ----------
function startRound(room) {
  room.state = 'playing';
  room.lives = LIVES;
  room.dots = MAP.map(row => [...row].map(ch => ch === '.'));

  let runnerCount = 0;
  for (const p of room.players.values()) {
    p.want = null;
    p.cur = { dx: 0, dy: 0 };
    p.alive = true;
    p.respawnAt = 0;
    p.protectedUntil = p.role === 'Runner' ? Date.now() + SHIELD_MS : 0;
    if (p.role === 'Hunter') {
      placeAt(p, HUNTER_SPAWN);
    } else {
      placeAt(p, RUNNER_SPAWNS[runnerCount % RUNNER_SPAWNS.length]);
      runnerCount++;
    }
    clearDot(room, Math.floor((p.x + TILE / 2) / TILE), Math.floor((p.y + TILE / 2) / TILE));
  }

  io.to(room.code).emit('gameStarted');
  room.timer = setInterval(() => tick(room), TICK_MS);
}

function endRound(room, title, reason) {
  clearInterval(room.timer);
  room.timer = null;
  room.state = 'ended';
  const winnerRole = title.startsWith('Hunter') ? 'Hunter' : 'Runner';
  const names = [...room.players.values()]
    .filter(p => p.role === winnerRole)
    .map(p => p.name);
  io.to(room.code).emit('gameOver', { title, reason, winnerRole, names });
}

function tick(room) {
  const now = Date.now();
  const players = [...room.players.values()];

  // 1) Move players, respawn caught runners, eat dots
  for (const p of players) {
    if (!p.alive) {
      if (now >= p.respawnAt) {
        placeAt(p, RUNNER_SPAWNS[Math.floor(Math.random() * RUNNER_SPAWNS.length)]);
        p.alive = true;
        p.protectedUntil = now + SHIELD_MS;
      }
      continue;
    }
    stepPlayer(p);

    if (p.role === 'Runner') {
      clearDot(room, Math.floor((p.x + TILE / 2) / TILE), Math.floor((p.y + TILE / 2) / TILE));
    }
  }

  // 2) Catching: a hunter touching a runner costs the runners 1 life
  const hunters = players.filter(p => p.role === 'Hunter');
  const runners = players.filter(p => p.role === 'Runner');
  for (const r of runners) {
    if (!r.alive || now < r.protectedUntil) continue;
    for (const h of hunters) {
      if (Math.hypot(r.x - h.x, r.y - h.y) < CATCH_DIST) {
        r.alive = false;
        r.respawnAt = now + RESPAWN_MS;
        r.want = null;
        r.cur = { dx: 0, dy: 0 };
        room.lives--;
        break;
      }
    }
  }

  // 3) Win checks
  const remainingDots = room.dots.reduce((n, row) => n + row.filter(Boolean).length, 0);
  let winnerTitle = null;
  let reason = '';
  if (hunters.length === 0) {
    winnerTitle = 'Runners win!';
    reason = 'The hunter left the game.';
  } else if (runners.length === 0) {
    winnerTitle = 'Hunter wins!';
    reason = 'No runners are left in the game.';
  } else if (room.lives <= 0) {
    winnerTitle = 'Hunter wins!';
    reason = `The runners lost all ${LIVES} lives.`;
  } else if (remainingDots === 0) {
    winnerTitle = 'Runners win!';
    reason = 'Every dot was collected.';
  }

  // 4) Send the new state to everyone in the room
  const dotList = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (room.dots[r][c]) dotList.push([c, r]);
    }
  }
  io.to(room.code).emit('state', {
    lives: room.lives,
    dots: dotList,
    players: players.map(p => ({
      id: p.id, name: p.name, role: p.role, x: p.x, y: p.y, alive: p.alive,
      shieldMs: Math.max(0, p.protectedUntil - now)
    }))
  });

  if (winnerTitle) endRound(room, winnerTitle, reason);
}

// ---------- SOCKETS ----------
io.on('connection', (socket) => {

  socket.on('createRoom', ({ name } = {}) => {
    name = cleanName(name);
    if (!name) return socket.emit('errorMsg', 'Please enter your name first.');

    const code = makeCode();
    const room = {
      code, owner: socket.id, state: 'lobby',
      players: new Map(), dots: null, lives: LIVES, timer: null
    };
    rooms[code] = room;
    addPlayer(room, socket, name);

    socket.emit('joined', { code, map: MAP });
    broadcastLobby(room);
  });

  socket.on('joinRoom', ({ name, code } = {}) => {
    name = cleanName(name);
    code = String(code || '').toUpperCase().trim();
    if (!name) return socket.emit('errorMsg', 'Please enter your name first.');

    const room = rooms[code];
    if (!room) return socket.emit('errorMsg', 'Room not found. Check the code.');
    if (room.state !== 'lobby') return socket.emit('errorMsg', 'This game has already started.');
    if (room.players.size >= MAX_PLAYERS) return socket.emit('errorMsg', 'This room is full.');

    addPlayer(room, socket, name);
    socket.emit('joined', { code, map: MAP });
    broadcastLobby(room);
  });

  socket.on('setRole', ({ role } = {}) => {
    const room = getRoom(socket);
    if (!room || room.state !== 'lobby') return;
    if (role !== 'Hunter' && role !== 'Runner') return;
    room.players.get(socket.id).role = role;
    broadcastLobby(room);
  });

  socket.on('startGame', () => {
    const room = getRoom(socket);
    if (!room || room.state !== 'lobby') return;
    if (room.owner !== socket.id) {
      return socket.emit('errorMsg', 'Only the room owner can start the game.');
    }
    if (room.players.size < 2) {
      return socket.emit('errorMsg', 'At least 2 players are needed to start.');
    }
    const list = [...room.players.values()];
    const hunters = list.filter(p => p.role === 'Hunter').length;
    const runners = list.length - hunters;
    if (hunters < 1 || runners < 1) {
      return socket.emit('errorMsg',
        'Please change your role. At least 1 player is needed for Hunter and 1 for Runner.');
    }
    startRound(room);
  });

  socket.on('move', ({ dx, dy } = {}) => {
    const room = getRoom(socket);
    if (!room || room.state !== 'playing') return;
    const p = room.players.get(socket.id);
    if (!p || !p.alive) return;
    let ddx = Math.sign(Number(dx) || 0);
    let ddy = Math.sign(Number(dy) || 0);
    if (ddx && ddy) ddy = 0;                       // one direction at a time
    p.want = (ddx || ddy) ? { dx: ddx, dy: ddy } : null;
  });

  socket.on('backToLobby', () => {
    const room = getRoom(socket);
    if (!room || room.owner !== socket.id || room.state !== 'ended') return;
    room.state = 'lobby';
    broadcastLobby(room);
  });

  socket.on('disconnect', () => {
    const room = getRoom(socket);
    if (!room) return;
    room.players.delete(socket.id);
    if (room.players.size === 0) {
      clearInterval(room.timer);
      delete rooms[room.code];
      return;
    }
    if (room.owner === socket.id) {
      room.owner = room.players.keys().next().value;
    }
    broadcastLobby(room);
  });
});

server.listen(PORT, () => {
  console.log(`Pac-Man Haunt running on http://localhost:${PORT}`);
});
