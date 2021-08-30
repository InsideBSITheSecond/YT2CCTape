import electron, { ipcRenderer } from 'electron';
import React, { useState } from 'react';
import { MemoryRouter as Router, Switch, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.global.css';

import ProgressBar from 'react-bootstrap/ProgressBar';
import Button from 'react-bootstrap/Button';

const Hello = () => {
  const [url, setUrl] = useState('https://www.youtube.com/watch?v=rqtEGrSGFvw');
  const [progress, setProgress] = useState(0);
  const [taskStatus, setTaskStatus] = useState('Waiting for user input');

  ipcRenderer.on('download:progress', (event, data) => {
    setProgress(data.prog);
    setTaskStatus(data.desc);
  });

  return (
    <div>
      <div className="Hello">
        <img width="500px" alt="icon" src={icon} />
      </div>
      <h1>YT2CCTape</h1>
      <div>
        <input
          type="text"
          value={url}
          placeholder="Enter a message"
          onChange={(e) => setUrl(e.target.value)}
          style={{ width: '75%' }}
        />
        <Button
          id="b"
          onClick={() => {
            console.log(url);
            ipcRenderer.send('video:download', { url: url, name: 'test.mp4' });
          }}
          style={{ width: '25%' }}
        >
          Download
        </Button>
      </div>
      <p>{taskStatus}</p>
      <ProgressBar id="pb" now={progress} />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/" component={Hello} />
      </Switch>
    </Router>
  );
}
