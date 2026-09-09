import { createRoot } from 'react-dom/client';
import App from './reader/App.tsx';
import { SourceViewerProvider } from './reader/SourceViewer.tsx';
createRoot(document.getElementById('root')!).render(<SourceViewerProvider><App /></SourceViewerProvider>);
