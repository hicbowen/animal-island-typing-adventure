// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Cursor } from 'animal-island-ui'
import 'animal-island-ui/style'
import './index.css'
import App from './App.tsx'
import cursorIcon from '../node_modules/animal-island-ui/dist/files/cursor-icon.1ea93a65.png'

document.body.classList.add('animal-cursor', 'animal-cursor--force')
document.documentElement.style.setProperty('--island-cursor', `url("${cursorIcon}") 4 0, auto`)

createRoot(document.getElementById('root')!).render(
  <Cursor>
    <App />
  </Cursor>
)
