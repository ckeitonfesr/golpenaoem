const firebaseConfig = {
  apiKey: "AIzaSyAvQhlvBDTaUfsQywQe81Hs9tMV1h-61Lc",
  authDomain: "leiloes-d9567.firebaseapp.com",
  databaseURL: "https://leiloes-d9567-default-rtdb.firebaseio.com",
  projectId: "leiloes-d9567",
  storageBucket: "leiloes-d9567.firebasestorage.app",
  messagingSenderId: "206835536803",
  appId: "1:206835536803:web:a629f3ca3e9a58daf60016",
  measurementId: "G-XMVWKXVDZV"
};

function isFirebaseConfigured() {
  return firebaseConfig.apiKey && 
         firebaseConfig.apiKey !== "AIzaSyDummyKeyReplaceWithYourOwn" &&
         firebaseConfig.projectId && 
         firebaseConfig.projectId !== "your-project-id" &&
         typeof firebase !== 'undefined';
}

window.FIREBASE_CONFIGURED = false;

if (typeof firebase !== 'undefined' && isFirebaseConfigured()) {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.database();
    window.analytics = firebase.analytics();
    window.storage = firebase.storage();
    window.FIREBASE_CONFIGURED = true;
  } catch (error) {
    console.warn('Firebase não configurado corretamente. O sistema funcionará em modo local.');
    window.FIREBASE_CONFIGURED = false;
  }
} else {
  window.FIREBASE_CONFIGURED = false;
}
