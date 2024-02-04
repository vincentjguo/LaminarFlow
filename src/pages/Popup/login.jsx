import React, { useState } from "react";
import { TextField, Button } from '@material-ui/core';
import './Popup.css';
import Cookies from 'js-cookie'
import {set_api_url, authenticate} from "./requests"


function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [login_failed, setStatus] = useState(false)


  const handleLogin = async () => {
    try {
      console.log("Requesting login...")
      set_api_url(server)
      console.log("Using server " + server)
      const response = await authenticate(username, password)
      if (response.status >= 400) {
        console.log(
          'Login failed with status ' +
            response.status +
            ' and message ' +
            response.body
        );
        setStatus(true);
      }
      else {
        let token = await response.json()
        console.log("Login success with token:" + token.access_token.toString());

        await chrome.storage.local.set({ access_token: token.access_token }).then(() => console.log("Cookie stored"));
        await chrome.storage.local.set({ questAPI_username: username }).then(() => console.log("Username stored"));
        setStatus(false);
        onLogin(username);
      }
    } catch (e) {
      setStatus(true)
    }
  };

  return (
    <div className="login-form">
      <TextField value={username} onChange={e => setUsername(e.target.value)} label="Username or Email" variant="outlined" fullWidth />
      <TextField value={password} onChange={e => setPassword(e.target.value)} label="Password" type="password" variant="outlined" fullWidth />
      <TextField value={server} onChange={e => setServer(e.target.value)} label="QuestAPI URL" variant="outlined" fullWidth />
      {login_failed && <h4 className="login_error">Login Failed, check credentials or server</h4>}
      <Button onClick={handleLogin} variant="contained" color="primary">Login</Button>
    </div>
  );
}

export default LoginForm;