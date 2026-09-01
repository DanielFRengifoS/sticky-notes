import { Board } from './board/Board';
import './App.css';

export function App() {
  return (
    <div className="app">
      <header className="appHeader">
        <h1>Sticky Notes</h1>
        <p>Create, edit, move, resize, and delete notes.</p>
      </header>

      <Board />
    </div>
  );
}
