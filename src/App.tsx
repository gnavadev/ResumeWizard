import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import MainUI from './components/MainUI';
import DocumentManager from './components/DocumentManager';
import KeywordsWindow from './components/KeywordsWindow';
import Settings from './components/Settings';

export default function App() {
  return (
    <Routes>
      {/* Main app windows use the layout */}
      <Route
        path="/"
        element={
          <Layout>
            <MainUI />
          </Layout>
        }
      />
      <Route
        path="/documents"
        element={
          <Layout>
            <DocumentManager />
          </Layout>
        }
      />
      <Route
        path="/settings"
        element={
          <Layout>
            <Settings />
          </Layout>
        }
      />

      {/* Child window routes (no layout) */}
      <Route path="/keywords" element={<KeywordsWindow />} />
    </Routes>
  );
}
