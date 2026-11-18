# Deepnames

A Deepwoken-themed, real-time multiplayer take on Codenames. The **Etreans** face the **Authority** on a 4 × 5 board. Grey cards are bystanders, and **Ethiron** is the assassin: reveal it and your side loses on the spot.

## How it works

- One player creates a room and gets a 4-letter code, a link and a QR code.
- Everyone else scans the code or opens the link on their own phone. The lobby shows each player live as they join, with an online/offline dot.
- Pick a side. Each side needs one spymaster and at least one operative. The host starts the game.
- The server holds the only copy of the game. Every phone gets the same board, turn, clue and timer at the same moment. Operatives' phones never receive the colour key.

## Rules (standard Codenames, 20-card board)

- The side that goes first has 7 agents; the other has 6. There are 6 bystanders and 1 Ethiron.
- The spymaster gives one word plus a number. The game rejects clues that match or contain a word still on the board.
- Operatives tap a card to suggest it, then press **Reveal**. They get the number + 1 guesses; 0 or ∞ means unlimited. They must make at least one guess before ending the turn.
- A bystander or a rival agent ends the turn. A rival agent also counts for the rival side.
- Reveal Ethiron and you lose. Find all your agents and you win, even if the other side reveals your last one for you.
- Anti-cheat: a player who has seen the key can't become an operative until the next game, and nobody can switch sides mid-game.

## Extras

- Optional turn timer (60 s to 4 min; when it runs out the turn passes).
- Host tools: shuffle teams, remove players, hand over hosting, end the game, rematch (with or without rotating spymasters).
- Players reconnect to the same seat after a refresh or a dropped connection.
- Sound effects, an Ethiron screen-shake ending and victory screens.
- Word packs: 563 names taken from the Deepwoken wiki categories (races, oaths, attunements, locations, dungeons, monsters, bosses, NPCs, weapons, relics, mechanics), plus an optional everyday-words pack and custom words set in the lobby. Edit `words.js` to change them.

## Run it locally

```bash
npm install
npm start
```

Then open http://localhost:3000. Other devices on the same Wi-Fi can join with `http://<your-computer's-IP>:3000`.

## Put it online (free)

1. Push this folder to a GitHub repository.
2. On https://render.com, sign in with GitHub, choose **New → Blueprint**, pick the repository and press **Apply**. `render.yaml` sets up everything.
3. You get a public address like `https://deepnames.onrender.com`. The lobby's QR code uses that address automatically.

On Render's free plan the server sleeps after about 15 minutes with nobody connected. The first visit after that takes around 30 seconds to wake it. Rooms live in memory, so a restart clears open rooms.

## Tests

```bash
npm test
```

This runs the rule tests and a full multiplayer test with five simulated players over real sockets.
