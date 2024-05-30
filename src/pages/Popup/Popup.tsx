import React, { useEffect, useState } from "react";
import LoginForm, { logout } from "./login";
import "./Popup.css";
import { WebsocketClient, WebsocketResponse, WebsocketStatus } from "../../websocket-client/websocket";
import { Button } from "@material-ui/core";


const Popup = () => {
  const [loggedInUsername, setLoggedInUsername] = useState('');
  const [loading, setLoading] = useState(true);


  async function isAuth(): Promise<string> {
    const token = await chrome.storage.local.get({access_token: ''})
    console.log("Existing Token: ", token.access_token)
    const username = await chrome.storage.local.get({questAPI_username: ''})
    console.log("Existing Username: ", username.questAPI_username)
    const server_url = await chrome.storage.local.get({questAPI_url: ''})
    console.log("Existing Server URL: ", server_url.questAPI_url)

    if (token.access_token === '' || username.questAPI_username === '' || server_url.questAPI_url === '') {
      console.log("No token or username found. Authentication needed")
      return ''
    }

    console.log(`Reconnecting to ${server_url.questAPI_url}`)

    let response = await chrome.runtime.sendMessage(
      {
        type: 'reconnect',
        data: [token.access_token, server_url.questAPI_url],
      }).catch(() => {
      console.log('Reconnect failed');
      return { status: WebsocketStatus.ERROR, payload: 'Reconnect failed' };
    });

    if (response.status == WebsocketStatus.SUCCESS) {
      return username.questAPI_username
    } else {
      console.log('Token invalid. Logging out');
      handleLogout();
      return ''
    }

    
  }
  
  const handleLogin = (username: string) => {
    setLoggedInUsername(username)
  }

  
  function handleLogout() {
    setLoggedInUsername('')
    chrome.runtime.sendMessage({ type: 'logout' }).then();
    console.log("Logged out")
  }


  useEffect( () => {
    async function fetchData(): Promise<void> {
      try {
        // set loading to true before calling API
        setLoading(true);
        const loggedInUsername = await isAuth();
        setLoggedInUsername(loggedInUsername);
      } catch (error) {
        console.log(error);
        console.log('User not signed in');
      }
    }
    fetchData().then( r => setLoading(false));
  }, []);

  if (loading) {
    return <span>Loading</span>;
  }
  else if (loggedInUsername == '') {
    console.log('Redirecting to login form');
    return (
      <div className="App">
        <LoginForm onLogin={handleLogin} />
      </div>
    );
  }
  else {
    console.log("User ", loggedInUsername, " is logged in. Redirecting to home page");
    return (
      <div className="App">
        <div>
          <h4>Welcome {loggedInUsername}</h4>
          <Button onClick={handleLogout} variant="contained" color="primary">
            Logout
          </Button>
        </div>
      </div>
    );
  }
};

export default Popup;
