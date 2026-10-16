# 👻 Pac-Man Haunt

A real-time multiplayer Pac-Man style game where **hunters** chase **runners** through a maze. Create a room, invite your friends with a code, pick your team, and play.

Built with **Node.js**, **Express**, **Socket.IO**, and **HTML5 Canvas**.

---

## ✨ Features

- 🏠 **Rooms with codes:** Create a room and share the 4-letter code, or join one with a code.
- 👑 **Room owner:** Only the owner can start the game.
- 🎭 **Teams:** Choose **Hunter** or **Runner** in the waiting room. Everyone can see each choice.
- ✅ **Team check:** A game needs at least 1 hunter and 1 runner before it can start.
- 🟢🔴 **Team colors:** Runners are green, the hunter is red, so you can spot teammates at a glance.
- 🧭 **Grid movement:** Characters move only along the maze paths and can't get stuck in walls.
- 🟡 **Dots:** Runners win by collecting every dot.
- ❤️ **Lives:** The hunter wins by catching runners until they lose all 3 lives.
- 🛡️ **Spawn protection:** Runners are safe for 2 seconds after spawning or respawning.
- 💬 **Catch messages:** A short "Ouch!", "Wasted!", or "Ohh no!" appears when a runner is caught.
- 🏆 **Ending screen:** Shows the winning team and its player names.
- 📱 **Mobile support:** An on-screen arrow pad appears on touch screens.
- 🌌 **3D background:** A scrolling field of floating shapes, built with Three.js.

---

## 🎮 How to Play

1. Enter your name.
2. Click **Create Room** (you become the owner) or **Join Room** and enter the code.
3. In the waiting room, pick **Hunter** or **Runner**.
4. The owner clicks **Start Game** when everyone is ready.
5. Runners collect dots and avoid the hunter. The hunter tries to catch them.

### Controls

| Device | Move |
| --- | --- |
| Computer | Arrow keys or `W` `A` `S` `D` |
| Phone or tablet | On-screen ▲ ◀ ▶ ▼ buttons |

---

## 🛠️ Requirements

- [Node.js](https://nodejs.org/) (version 18 or newer is recommended)
- A web browser (Chrome, Edge, Firefox, etc.)

---

## 🚀 Getting Started

1. **Download the project**
   - Click the green **Code** button on GitHub, then **Download ZIP**.
   - Unzip the folder.

2. **Open the folder in a terminal**
   - On Windows, open the folder in File Explorer, click the address bar, type `cmd`, and press Enter.

3. **Install the dependencies** (only needed once)
   ```bash
   npm install
   ```

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open the game**
   - Go to **http://localhost:3000** in your browser.
   - To test with friends on the same network, open the same address on their devices using your computer's local IP.

To stop the server, press `Ctrl + C` in the terminal.

---

## 📁 Project Structure

```
pacman-haunt/
├── server.js          # Game server: rooms, roles, movement, catching, lives
├── package.json       # Project info and dependencies
├── README.md          # This file
└── public/
    ├── index.html     # Screens, game drawing, and client logic
    └── style.css      # Styling (cards, buttons, animations, layout)
```

---

## 🧰 Tech Stack

- **Backend:** Node.js, Express, Socket.IO
- **Frontend:** HTML, CSS, JavaScript, HTML5 Canvas
- **3D background:** Three.js

The server controls the game (movement, dots, catches, and win checks), so every player sees the same game.

---

## 🗺️ Ideas for the Future

- Sound effects
- Power-ups for runners
- Play-again button without going back to the waiting room
- Swipe controls on the maze for phones

---

## 🤝 Contributing

Suggestions and pull requests are welcome! Feel free to open an issue to share ideas or report bugs.

---

Made with ❤️ by **Karan**
