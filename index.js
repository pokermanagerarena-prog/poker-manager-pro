import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TournamentProvider } from './store';
import { HashRouter } from 'react-router-dom';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

// Remplacement du JSX par son équivalent JavaScript pur
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(HashRouter, null,
      React.createElement(TournamentProvider, null,
        React.createElement(App, null)
      )
    )
  )
);