import React, { useEffect, useState } from "react";
import { TextField, Button, FormControlLabel, Checkbox } from "@material-ui/core";
import './Popup.css';
import { WebsocketClient, WebsocketResponse, WebsocketStatus } from "../../websocket-client/websocket";

export function logout(client: WebsocketClient) {
  chrome.storage.local.remove(["access_token", "questAPI_username", "questAPI_url"])
    .then(r => console.log("Removed cached data for user"));
  client.signout()
}

function handleLogout() {
  chrome.runtime.sendMessage({ type: 'logout' }).then();
  chrome.storage.local.remove(["access_token"]).then()
  console.log("Logged out")
}

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


function LoginForm({ onLogin }: { onLogin: (isLoggedIn: boolean, user: string) => void}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState('');
  const [remember_me, setRememberMe] = useState(false);
  const [login_failed, setStatus] = useState(false)
  const [loading, setLoading] = useState(false)
  const [duo_auth, setDuoAuth] = useState("")

  const handleResponse = async (response: WebsocketResponse): Promise<boolean> => {
    console.debug("Handling login response: ", response)

    if (response.status == WebsocketStatus.CLOSED) {
      console.error(
        'Login failed and connection closed with reason: ' +
        response.payload
      );
      setStatus(true);
      setLoading(false);
      setDuoAuth("")
      return false;
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
      return false;
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
      onLogin(true, username);
      return true;
    } else {
      console.error('Login failed with reason ' + response.payload);
      setStatus(true);
      setLoading(false);
      setDuoAuth("")
      return false;
    }
  }

  const handleLogin = async () => {
    try {
      setLoading(true)
      setStatus(false)
      setDuoAuth("")
      console.log("Requesting login...")
      await chrome.storage.local.set({ questAPI_username: username }).then(() => console.log("Username stored"));
      await chrome.storage.local.set({ questAPI_url: server }).then(() => console.log("Server stored"));
      console.log('Using server ' + server);
      await chrome.runtime.sendMessage({ type: 'login', data: [username, password, remember_me, server] })
        .then(async (response) => {
        await handleResponse(response)
      })


    } catch (e) {
      console.error('Login failed with reason ' + e);
      setStatus(true)
      setLoading(false)
      setDuoAuth("")
    }
  };



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

        setUsername(username);
        setServer(server_url);
        console.debug('Username: ', username, ' | Server: ', server_url)
        let connection_pending: WebsocketResponse | null =
          await chrome.runtime.sendMessage({ type: 'check_existing_login' });

        console.debug(connection_pending);
        let isLoggedIn = false;
        if (connection_pending) {
          isLoggedIn = await handleResponse(connection_pending);
        } else {
          isLoggedIn = await isAuth(token, username, server_url);
        }

        if (isLoggedIn)
          onLogin(isLoggedIn, username);
      } catch (error) {
        console.log(error);
        console.log('User not signed in');
      }
    }
    fetchData().then( r => setLoading(false));
  }, []);

  return (
    <form className="login-form" onSubmit={event => {event.preventDefault()}}>
      <TextField value={username} onChange={e => setUsername(e.target.value)} required label="Username or Email" variant="outlined" fullWidth />
      {!(loading && !password.length) && <TextField value={password} onChange={e => setPassword(e.target.value)} required label="Password" type="password" variant="outlined" fullWidth />}
      <TextField value={server} onChange={e => setServer(e.target.value)} required label="QuestAPI URL" variant="outlined" fullWidth />
      {login_failed && <h4 className="login-error">Login Failed, check credentials or server</h4>}
      {loading ? <span>Loading</span> : <Button type="submit" onClick={handleLogin} variant="contained" color="primary">Login</Button>}
      {duo_auth != "" ? <span>Please enter duo auth code {duo_auth}</span> : null}
      {!(loading && !password.length) && <FormControlLabel control={<Checkbox onChange={event => setRememberMe(event.target.checked)}/>} label={"Remember Me"} />}
    </form>
  );
}

export default LoginForm;