import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAy3q7nu3WK7NYtM1lrFET7iauf3qYlvkY',
  authDomain: 'crown-and-blade-booking.firebaseapp.com',
  databaseURL: 'https://crown-and-blade-booking-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'crown-and-blade-booking',
  storageBucket: 'crown-and-blade-booking.firebasestorage.app',
  messagingSenderId: '39509368211',
  appId: '1:39509368211:web:868c3188a51d1ecab05c66',
  measurementId: 'G-8PB4ZZ70SC',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
