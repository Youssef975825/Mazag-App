// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBOG-nTIT7thv8oVyWL-frmtC_CijXyTjo",
  authDomain: "mini-mazag.firebaseapp.com",
  projectId: "mini-mazag",
  storageBucket: "mini-mazag.firebasestorage.app",
  messagingSenderId: "78358883482",
  appId: "1:78358883482:web:66fdf95365d4c2a5050323"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);