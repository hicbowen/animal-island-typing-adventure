import { createRoot } from 'react-dom/client'
import { Cursor } from 'animal-island-ui'
import 'animal-island-ui/style'
import './index.css'
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <Cursor>
    <App />
  </Cursor>
)
