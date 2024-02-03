import React, { useState } from 'react';
import { Button, TextField } from '@material-ui/core';
import { search_classes } from './requests';

function logout() {
  return true;
}


function Home({ username, onLogout }) {
  const [term, setTerm] = useState('');
  const [subject, setSubject] = useState('');
  const [class_number, setClassNumber] = useState('');
  async function get_classes(term, subject, class_number) {
    const tokenData = await chrome.storage.local.get(["access_token"]);
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      throw new Error('Access token not found');
    }

    return await search_classes(term, subject, class_number, accessToken);
  }
  const handleSearch = async () => {
    const response = await get_classes(term, subject, class_number)
    if (!response) {
      await chrome.storage.local.remove(["access_token"]).then(r => console.log("Logged out"))
      onLogout();
    } else if (response.status >= 400) {
        console.log(
          'Search failed with status ' +
            response.status +
            ' and message ' +
            response.body
        );
    } else {
      let classes = await response.json();
      console.log("Search success with classes:" + JSON.stringify(classes));
    }
  }
  const handleLogout = async () => {
    logout();
    await chrome.storage.local.remove(["access_token"]).then(r => console.log("Logged out"))
    onLogout();
  };
  return (
    <div>
      <h4>Welcome {username}</h4>
      <Button onClick={handleLogout} variant="contained" color="primary">
        Logout
      </Button>
      <TextField value={term} onChange={e => setTerm(e.target.value)} label="term" variant="outlined" fullWidth />
      <TextField value={subject} onChange={e => setSubject(e.target.value)} label="subject" variant="outlined" fullWidth />
      <TextField value={class_number} onChange={e => setClassNumber(e.target.value)} label="class_number" variant="outlined" fullWidth />
      <Button onClick={handleSearch} variant="contained" color="primary">
        Search
      </Button>
    </div>
  );
}

export default Home;