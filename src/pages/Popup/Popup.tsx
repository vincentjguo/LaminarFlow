import React, { useEffect, useState } from "react";
import LoginForm, { logout } from "./login";
import "./Popup.css";
import { Button } from "@material-ui/core";


const Popup = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  
  const handleLogin = (isLoggedIn: boolean, name: string) => {
    setLoggedIn(isLoggedIn)
    setUsername(name)
  }

  
  function handleLogout() {
    setLoggedIn(false)
    chrome.runtime.sendMessage({ type: 'logout' }).then();
    chrome.storage.local.remove(["access_token"]).then()
    console.log("Logged out")
  }

  useEffect( () => {
    (async () => {
      setLoading(true);
      console.debug("Checking login...")
      await chrome.runtime.sendMessage({ type: 'check_logged_in' }).then((response) => {
        console.debug("Received login response: ", response);
        setLoggedIn(response);
      });
    })().then(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!loggedIn) {
    console.log('Redirecting to login form');
    return (
      <div className="App">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }
  else {
    console.log("User ", username, " is logged in. Redirecting to home page");
    return (
      <div className="App">
        <div>
          <h4>Welcome {username}</h4>
          <Button onClick={handleLogout} variant="contained" color="primary">
            Logout
          </Button>
        </div>
      </div>
    );
  }
};

export default Popup;
