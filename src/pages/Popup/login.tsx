import React, { useState } from "react";
import { TextField, Button, FormControlLabel, Checkbox } from "@material-ui/core";
import './Popup.css';
import { WebsocketClient, WebsocketResponse, WebsocketStatus } from "../../websocket-client/websocket";

export function logout(client: WebsocketClient) {
  chrome.storage.local.remove(["access_token", "questAPI_username", "questAPI_url"])
    .then(r => console.log("Removed cached data for user"));
  client.signout()
}


function LoginForm({ onLogin }: { onLogin: (username: string) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [remember_me, setRememberMe] = useState(false);
  const [login_failed, setStatus] = useState(false)
  const [loading, setLoading] = useState(false)
  const [duo_auth, setDuoAuth] = useState("")



  const handleLogin = async () => {
    try {
      setLoading(true)
      setStatus(false)
      setDuoAuth("")
      console.log("Requesting login...")
      await chrome.storage.local.set({ questAPI_url: server }).then(() => console.log("Server stored"));
      console.log('Using server ' + server);
      let response = await chrome.runtime.sendMessage({ type: 'login', data: [username, password, remember_me, server] })

      console.debug(response)

      if (response.status == WebsocketStatus.CLOSED) {
        console.error(
          'Login failed and connection closed with reason: ' +
            response.payload
        );
        setStatus(true);
        setLoading(false);
        setDuoAuth("")
        return;
      } else if (response.status == WebsocketStatus.PARTIAL_SUCCESS) {
        console.log('Duo auth required');
        // handle duo auth
        setDuoAuth(response.payload);
        response = await chrome.runtime.sendMessage({ type: 'receive' });
      } else if (response.status == WebsocketStatus.ERROR) {
        console.error(
          'Connection failed with reason:  ' + response.payload
        );
        setStatus(true);
        setLoading(false);
        setDuoAuth("")
        return;
      }

      if (response.status == WebsocketStatus.SUCCESS) {
        let token = response.payload;
        console.log('Login success with token:' + token);

        await chrome.storage.local
          .set({ access_token: token })
          .then(() => console.log('Token stored'));
        await chrome.storage.local
          .set({ questAPI_username: username })
          .then(() => console.log('Username stored'));
        setStatus(false);
        setLoading(false);
        onLogin(username);
      } else {
        console.error('Login failed with reason ' + response.payload);
        setStatus(true);
        setLoading(false);
        setDuoAuth("")
      }


    } catch (e) {
      console.error('Login failed with reason ' + e);
      setStatus(true)
      setLoading(false)
      setDuoAuth("")
    }
  };

  return (
    <form className="login-form" onSubmit={event => {event.preventDefault()}}>
      <TextField value={username} onChange={e => setUsername(e.target.value)} required label="Username or Email" variant="outlined" fullWidth />
      <TextField value={password} onChange={e => setPassword(e.target.value)} required label="Password" type="password" variant="outlined" fullWidth />
      <TextField value={server} onChange={e => setServer(e.target.value)} required label="QuestAPI URL" variant="outlined" fullWidth />
      {login_failed && <h4 className="login_error">Login Failed, check credentials or server</h4>}
      {loading ? <span>Loading</span> : <Button type="submit" onClick={handleLogin} variant="contained" color="primary">Login</Button>}
      {duo_auth != "" ? <span>Please enter duo auth code {duo_auth}</span> : null}
      <FormControlLabel control={<Checkbox onChange={event => setRememberMe(event.target.checked)}/>} label={"Remember Me"} />
    </form>
  );
}

export default LoginForm;