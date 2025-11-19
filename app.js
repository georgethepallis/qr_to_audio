/* ---------------------------- */
/*  Firebase Init               */
/* ---------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyDHiFqgdHCUSrkQ69jLu9PdQERVuH0V35o",
  authDomain: "boardgame2025-de850.firebaseapp.com",
  databaseURL:
    "https://boardgame2025-de850-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "boardgame2025-de850",
  storageBucket: "boardgame2025-de850.firebasestorage.app",
  messagingSenderId: "213373977914",
  appId: "1:213373977914:web:3259e35f2f92bf318e3c03",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ---------------------------- */
/*  Globals                     */
/* ---------------------------- */

const header = document.getElementById("header");
const textDisplay = document.getElementById("textDisplay");
let folderID = new URLSearchParams(location.search).get("id") || "folder1";

let queueState = null;
let firstTapDone = false;
let lastTapTime = 0;

/* ---------------------------- */
/*  Load library.json           */
/* ---------------------------- */

async function loadLibrary() {
  const res = await fetch("library.json");
  return res.json();
}

/* ---------------------------- */
/*  Get Queue from Firebase     */
/* ---------------------------- */

function getQueueRef() {
  return db.ref("queues/" + folderID);
}

async function loadQueue(library) {
  const ref = getQueueRef();
  const snap = await ref.get();

  if (snap.exists()) {
    queueState = snap.val();
  } else {
    const files = library[folderID];
    queueState = {
      remaining: shuffle(files),
      played: [],
      current: null,
    };
    await ref.set(queueState);
  }
}

/* ---------------------------- */
/*  Save Queue to Firebase      */
/* ---------------------------- */

function saveQueue() {
  return getQueueRef().set(queueState);
}

/* ---------------------------- */
/*  Shuffle helper              */
/* ---------------------------- */

function shuffle(arr) {
  return arr.slice().sort(() => Math.random() - 0.5);
}

/* ---------------------------- */
/*  Get Next File (random)      */
/* ---------------------------- */

async function nextFile() {
  if (queueState.remaining.length === 0) {
    queueState.remaining = shuffle(queueState.played);
    queueState.played = [];
  }

  const file = queueState.remaining.pop();
  queueState.played.push(file);
  queueState.current = file;

  await saveQueue();
  return file;
}

/* ---------------------------- */
/*  Load and speak text         */
/* ---------------------------- */

async function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);

  return new Promise((resolve) => {
    utter.onend = resolve;
  });
}

async function playCurrentFile(library) {
  const file = queueState.current;
  const txt = await fetch(`library/${folderID}/${file}`).then((r) => r.text());

  textDisplay.textContent = txt;
  await speak(txt);
}

/* ---------------------------- */
/*  Tap / Double-Tap Logic      */
/* ---------------------------- */

async function handleTap(library) {
  const now = Date.now();

  if (now - lastTapTime < 300) {
    // Double tap → go to answer (next folder)
    folderID = getNextFolder(library);
    location.href = `?id=${folderID}`;
    return;
  }

  lastTapTime = now;

  if (!firstTapDone) {
    header.textContent = "Tap to replay, double tap for answer";
    firstTapDone = true;

    // First start
    if (!queueState.current) {
      await nextFile();
    }
    await playCurrentFile(library);
  } else {
    // Single tap → replay same audio
    await playCurrentFile(library);
  }
}

/* ---------------------------- */
/*  Cycle to next folder        */
/* ---------------------------- */

function getNextFolder(library) {
  const keys = Object.keys(library);
  let i = keys.indexOf(folderID);
  i = (i + 1) % keys.length;
  return keys[i];
}

/* ---------------------------- */
/*  Init App                    */
/* ---------------------------- */

document.addEventListener("DOMContentLoaded", async () => {
  const library = await loadLibrary();
  await loadQueue(library);

  document.body.addEventListener("pointerdown", () => {
    handleTap(library);
  });
});
