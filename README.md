# Game Server

WebSocket server for the game using SQLite database for user storage.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node server.js
   ```

The server will:
- Create the SQLite database (`users.db`) automatically on first run
- Migrate existing users from `registeredUsers.json` if it exists (only if database is empty)
- Start listening on port 8080 (all network interfaces)

## Database

- **Database file:** `users.db` (created automatically)
- **Migration:** If `registeredUsers.json` exists and the database is empty, users will be automatically migrated on first startup

## Configuration

- **Port:** 8080 (hardcoded in server.js)
- **Host:** 0.0.0.0 (listens on all network interfaces)

## Dependencies

- `ws` - WebSocket server
- `msgpackr` - MessagePack encoding/decoding
- `sqlite3` - SQLite database

