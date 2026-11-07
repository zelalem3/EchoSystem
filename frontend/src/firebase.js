import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Import this

const firebaseConfig = {
  apiKey: "AIzaSyAyHEpgAQvPQBD4db3T3PMJwSPyPW10W-0",
  authDomain: "parity-bb037.firebaseapp.com",
  projectId: "parity-bb037",
  appId: "1:381842587459:web:bf89478a5e0ad7643679f6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app); 

export default app;