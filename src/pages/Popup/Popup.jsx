import React, { useState } from "react";
import LoginForm from "./login";
import Home from "./home"
import './Popup.css';

function isAuth() {
  return chrome.storage.local.get({access_token: "invalid"}).then((token) => {
    console.log("Existing Token: ")
    console.log(token.access_token)
    return token.access_token !== 'invalid'
  })
}

const Popup = () => {
  const [loggedInUsername, setLoggedInUsername] = useState('');

  const handleLogin = (username) => {
    setLoggedInUsername(username)
  }

  function handleLogout() {
    setLoggedInUsername('')
    console.log("Logged out")
  }

  return (
    <div className="App">
          {loggedInUsername !== '' ? <Home username={loggedInUsername} onLogout={handleLogout} /> :
            <LoginForm onLogin={handleLogin} />}
    </div>
  );
};

export default Popup;
