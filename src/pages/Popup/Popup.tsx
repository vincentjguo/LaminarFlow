import React, { useEffect, useState } from "react";
import LoginForm, { logout } from "./login";
import "./Popup.css";
import { WebsocketClient, WebsocketResponse, WebsocketStatus } from "../../websocket-client/websocket";
import { Button } from "@material-ui/core";


const Popup = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [server, setServer] = useState('');


  async function isAuth(token: string, username: string, server_url: string): Promise<boolean> {

    if (token === '' || username === '' || server_url === '') {
      console.log("No token or username found. Authentication needed")
      return false
    }

    console.log(`Reconnecting to ${server_url}`)

    let response = await chrome.runtime.sendMessage(
      {
        type: 'reconnect',
        data: [token, server_url],
      }).catch(() => {
      console.log('Reconnect failed');
      return { status: WebsocketStatus.ERROR, payload: 'Reconnect failed' };
    });

    if (response.status == WebsocketStatus.SUCCESS) {
      return true
    } else {
      console.log('Token invalid. Logging out');
      handleLogout();
      return false
    }

    
  }
  
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
    async function fetchData(): Promise<void> {
      try {
        // set loading to true before calling API
        setLoading(true);

        let token = (await chrome.storage.local.get({access_token: ''})).access_token
        console.log("Existing Token: ", token)
        let username = (await chrome.storage.local.get({questAPI_username: ''})).questAPI_username
        console.log("Existing Username: ", username)
        let server_url = (await chrome.storage.local.get({questAPI_url: ''})).questAPI_url
        console.log("Existing Server URL: ", server_url)

        const isLoggedIn = await isAuth(token, username, server_url);
        setLoggedIn(isLoggedIn);
        setUsername(username);
        setServer(server_url);
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
  else if (!loggedIn) {
    console.log('Redirecting to login form');
    console.debug("Username: ", username, " Server URL: ", server)
    return (
      <div className="App">
        <LoginForm onLogin={handleLogin}
                   default_username={username}
                   default_server={server}
        />
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
