import React, { useState } from 'react';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import firebaseconfig from './firebase';

function AuthComponent({setLoggedin}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false); 
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault(); // Prevent default form submission
    const auth = getAuth();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    try {
      let userCredential;
      if (isSignup) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Account created!");
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in!");
      }
      setUser(userCredential.user);
    } catch (err) {
      setError(err.message);
    }
  };

  if (user) {
   
setLoggedin(true);
  }

  return (
    <div className="App">
      <h1>{isSignup ? 'Create Account' : 'Login'}</h1>
      {error && <p style={{ color: 'red', fontSize: '14px' }}>{error}</p>}
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />
        <input 
          type='password' 
          placeholder='Password' 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button type="submit">
          {isSignup ? 'Sign Up' : 'Login'}
        </button>
      </form>

      <p style={{ marginTop: '10px', cursor: 'pointer', color: 'blue' }} 
         onClick={() => setIsSignup(!isSignup)}>
        {isSignup ? 'Already have an account? Login' : 'Need an account? Sign Up'}
      </p>
    </div>
  );
}

export default AuthComponent;