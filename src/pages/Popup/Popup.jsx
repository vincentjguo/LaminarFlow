import React, { useEffect, useState } from "react";
import LoginForm from "./login";
import Home from "./home"
import './Popup.css';
import { check_pulse } from "./requests";

async function isAuth() {
  const token = await chrome.storage.local.get({access_token: "invalid"})
  console.log("Existing Token: ", token.access_token)

  const username = await chrome.storage.local.get({questAPI_username: ""})
  console.log("Existing Username: ", username.questAPI_username)
  await check_pulse(token.access_token).then(response => { // TODO: This requires server to be cached
    if (response) {
      console.log("Session is still valid")
    }
    else {
      console.log("Stale session. Reauthentication needed")
      return ''
    }
  })

  return username.questAPI_username
}



const Popup = () => {
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [loading, setLoading] = useState(true);


  const handleLogin = (username) => {
    setLoggedInUsername(username)
  }

  
  function handleLogout() {
    setLoggedInUsername('')
    console.log("Logged out")
  }


  useEffect( () => {
    async function fetchData() {
      try {
        // set loading to true before calling API
        setLoading(true);
        const loggedInUsername = await isAuth();
        setLoggedInUsername(loggedInUsername);
        // switch loading to false after fetch is complete
        setLoading(false);
      } catch (error) {
        // add error handling here
        setLoading(false);
        console.log(error);
        console.log('User not signed in');
      }
    }
    fetchData();
  }, []);

  if(loading) return (
    <span>Loading</span>
  );

  if (loggedInUsername === '') {
    console.log('Redirecting to login form');
    return (
      <div className="App">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }
  else {
    console.log("User is already logged in. Redirecting to home page");
    return (
      <div className="App">
        <Home username={loggedInUsername} onLogout={handleLogout} />
      </div>
    );
  }
};

export default Popup;
