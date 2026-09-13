# Mazag 🌿

> عالمك الخاص.. بعيد عن زحمة السوشيال

Mazag is a real-time 1-on-1 chat app built with React, TypeScript, Tailwind CSS, and Firebase. It supports real authentication, a friend-request system, text/image/file/voice messages, typing indicators, read receipts, and browser notifications — all running on Firebase's free (Spark) tier.

## ✨ Features

- **Real authentication** — email/password sign up & login via Firebase Auth (not just a display-name gimmick)
- **Friend requests** — search by email, send/accept/reject requests; only accepted friends show up in your sidebar
- **Real-time messaging** — powered by Firestore's `onSnapshot` listeners
- **Attachments without a paid plan** — images and small files (≤700KB) are stored as base64 directly inside the message document, so no Firebase Storage / Blaze plan is required
- **Voice messages** — recorded in-browser (low-bitrate Opus, 60s max) and stored the same base64 way
- **Typing indicator** — "so-and-so is typing…"
- **Read receipts** — single/double checkmarks (✓ / ✓✓)
- **Browser notifications** — native OS notifications for new messages when the tab is in the background
- **Gender-aware avatars** — auto-generated avatars that respect the user's selected gender (no more mismatched hairstyles)
- **Dark / light mode**
- **Fully responsive** — the sidebar becomes a slide-in drawer on mobile

## 🛠 Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Backend | Firebase (Authentication + Firestore) |
| Hosting for attachments | None — base64 in Firestore (see [Limitations](#-known-limitations)) |

No custom backend server or Cloud Functions are used — everything runs client-side against Firebase.

## 📦 Getting Started

### Prerequisites

- Node.js 18+
- A [Firebase](https://console.firebase.google.com) project (free Spark plan is enough)

### 1. Clone & install

```bash
git clone https://github.com/<your-username>/mazag.git
cd mazag
npm install
```

### 2. Configure Firebase

Create a Firebase project, then enable:

- **Authentication** → Sign-in method → **Email/Password**
- **Firestore Database** → Create database (Native mode, any region)

Copy your Firebase web app config into `src/firebase.ts` (already scaffolded — just replace the `firebaseConfig` object with your own project's values).

### 3. Deploy the security rules

Copy the contents of [`firestore.rules`](./firestore.rules) into **Firestore Database → Rules** in the Firebase Console and hit **Publish**.

> ⚠️ The app will not work without these rules published — they enforce that users can only read/write their own conversations, friend requests, and profile.

### 4. Run it

```bash
npm run dev
```

Open the printed local URL, sign up with an email/password, and start chatting. To test the friend system you'll need a second account (a private/incognito window works well).

## 📁 Project Structure

```
src/
├── firebase.ts          # Firebase app/Auth/Firestore initialization
├── avatar.ts             # Gender-aware avatar URL generator
├── App.tsx               # Entry point — just renders <Chat />
├── components/
│   └── SidebarItems.tsx  # Sidebar nav item component
└── pages/ (or wherever Chat/Login/Sidebar live)
    ├── Chat.tsx           # Main chat screen, messaging logic, real-time listeners
    ├── Login.tsx          # Sign up / login screen
    └── Sidebar.tsx        # Friends list, friend requests, mobile drawer
```

> Adjust the tree above to match your actual folder layout — paths shown are relative import paths used across the codebase (`../firebase`, `../components/...`, `./Sidebar`, etc.).

## ⚠️ Known Limitations

These are intentional trade-offs to keep the project on Firebase's **free tier** (no Blaze / billing plan required):

- **Attachment size cap: 700KB.** Files are base64-encoded and stored inside the Firestore message document, which has a hard 1MB-per-document limit. There's no separate file storage bucket.
- **Voice messages capped at 60 seconds**, recorded at a low bitrate to keep the encoded size small.
- **Browser notifications only work while the tab is open** (foreground app, backgrounded tab). True push notifications for a fully closed browser would require Firebase Cloud Messaging + a Cloud Function, which needs the paid Blaze plan.
- **No message editing/deletion** — messages are immutable by design (Firestore rules block `update`/`delete` except for the `read` flag).

## 🔒 Security Notes

- Firestore Security Rules gate all reads/writes: a chat room's `roomId` is always `sortedUid1_sortedUid2`, and only those two users may read or write messages in it.
- Friend requests can only be created by the sender, and only accepted/rejected by the receiver.
- Only the message *recipient* can flip the `read` flag — senders can't fake read receipts on their own messages.

## 🤝 Contributing

Issues and PRs are welcome. If you're extending this project, check `firestore.rules` first — most features (friends, typing, read receipts) are enforced there, not just in the UI.

## 📄 License

MIT — feel free to fork and remix.
