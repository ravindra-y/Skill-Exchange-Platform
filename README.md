# Skill Exchange Platform

> A peer-to-peer web application for matching users based on complementary skills and facilitating live video sessions with a collaborative whiteboard.

This repository contains the full stack implementation of the Skill Exchange Platform, built as a capstone minimum viable product (MVP).

## Problem Statement
Finding people to trade skills with is difficult because matching complementary interests (what you can teach vs. what you want to learn) requires a specialized platform. This application solves that by deterministically matching users based on their listed skills, allowing them to send exchange requests, and providing a built-in, private WebRTC room to conduct the skill exchange session seamlessly without third-party apps.

## Features
* **Auth & Profiles**: Secure JWT-based authentication using HTTP-only cookies and bcrypt for password hashing. Users can manage their profiles and list skills they can teach or want to learn.
* **Skill Matching**: A deterministic algorithm that calculates a match score between users based on complementary teach/learn skills.
* **Exchange Requests**: Users can send, accept, and manage skill exchange requests from their matches.
* **Live Video Room**: A private, one-to-one WebRTC video and audio room initialized once an exchange request is accepted.
* **Collaborative Whiteboard**: A real-time synced canvas within the room for drawing and sharing ideas.
* **Local Session Recording**: Built-in browser recording of the video session via the `MediaRecorder` API. The recording is saved locally to the user's machine as a WebM file (it is never uploaded to the backend).

## Tech Stack

| Component | Technology |
| --- | --- |
| **Frontend** | React, React Router DOM, Tailwind CSS, Lucide React (Icons), Vite |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB Atlas, Mongoose |
| **Realtime / Signaling** | Socket.io, Socket.io-client |
| **Authentication** | JWT, bcrypt, express-validator, express-rate-limit |
| **Media** | WebRTC, MediaRecorder API, HTML5 Canvas |

## Architecture (Signaling & Realtime)
The live room feature utilizes WebRTC for peer-to-peer video and audio streams. Because WebRTC requires peers to exchange connection metadata (offers, answers, and ICE candidates) before a direct connection can be established, **Socket.io** is used as the signaling server.
- Media streams (audio and video) flow directly between the two users (peer-to-peer) and never pass through the Node.js backend.
- The Socket.io connection is only used to relay signaling messages and synchronize the collaborative whiteboard strokes.
- Room access is strictly authorized in the socket handler by validating the user's JWT against the participants of the associated `ExchangeRequest`.

## Screenshots

<!-- REPLACE THIS WITH A REAL SCREENSHOT OF THE DISCOVER PAGE -->
![Discover page](./docs/screenshots/discover.png)

<!-- REPLACE THIS WITH A REAL SCREENSHOT OF AN ACTIVE ROOM -->
![Active Room](./docs/screenshots/room.png)

<!-- REPLACE THIS WITH A REAL SCREENSHOT OF THE WHITEBOARD -->
![Whiteboard](./docs/screenshots/whiteboard.png)

<!-- REPLACE THIS WITH A REAL SCREENSHOT OF THE SESSION COMPLETE SCREEN -->
![Session Complete](./docs/screenshots/session-complete.png)

## Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- A MongoDB Atlas account and a valid cluster connection string

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/skill-exchange-platform.git
cd skill-exchange-platform
```

### 2. Setup the Server
Navigate to the `server` directory and install dependencies:
```bash
cd server
npm install
```

Create a `.env` file in the `server` directory based on the `.env.example`:
```bash
cp .env.example .env
```

**Environment Variables (`server/.env`)**
| Variable | Description | Example Value |
| --- | --- | --- |
| `PORT` | The port the backend runs on | `5000` |
| `MONGODB_URI` | Your MongoDB Atlas connection string | `mongodb+srv://<user>:<pw>@cluster0...` |
| `JWT_SECRET` | Secret key for signing JWTs | `super_secret_jwt_key_replace_me` |
| `NODE_ENV` | Environment mode | `development` |
| `CLIENT_URL` | The URL of the frontend app for CORS | `http://localhost:5173` |

### 3. Setup the Client
Open a new terminal, navigate to the `client` directory, and install dependencies:
```bash
cd client
npm install
```

### 4. Run the Development Servers
In the `server` directory, start the Express backend:
```bash
npm run dev
```

In the `client` directory, start the Vite development server:
```bash
npm run dev
```

### 5. Seed Demo Accounts (Optional)
To quickly test the matching algorithm and room logic, you can seed two complementary demo accounts (Rahul and Arjun). From the `server` directory, run:
```bash
npm run seed:demo
```
*You can then log in as `rahul@demo.com` and `arjun@demo.com` with the password `demo1234`.*

## Project Structure
```text
skill-exchange-platform/
├── client/                 # React frontend
│   ├── src/
│   │   ├── api/            # Axios instance
│   │   ├── components/     # Reusable UI (Navbar, ProtectedRoute)
│   │   ├── context/        # Auth Context
│   │   └── pages/          # React views (Dashboard, Discover, Room, etc.)
│   ├── package.json
│   └── vite.config.js
└── server/                 # Express backend
    ├── config/             # DB connection logic
    ├── middleware/         # Auth & validation middleware
    ├── models/             # Mongoose schemas (User, Skill, Room, etc.)
    ├── routes/             # REST API endpoints
    ├── seeders/            # Database seeding scripts
    ├── socket/             # Socket.io handlers
    ├── package.json
    └── server.js           # Express entry point
```

## Known Limitations
* **TURN Server Missing**: The application relies on free Google STUN servers. If both peers are behind symmetric NATs or strict firewalls, the WebRTC connection may fail because a TURN server is not provided.
* **No Group Calls**: The room architecture and WebRTC mesh are hardcoded for exactly two participants.
* **No Cloud Recording**: Recordings rely purely on the browser's `MediaRecorder` API and are downloaded locally. If a browser crashes before the session ends, the recording is lost.
* **Basic Matching Algorithm**: Matching is strictly deterministic and based on exact database skill matches; there is no AI or fuzzy semantic matching involved.

## License
*No license is currently specified for this repository. Please consider adding an open-source license (such as MIT) if you plan to share this publicly.*
