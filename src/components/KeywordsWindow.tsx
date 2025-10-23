import React, { useState, useEffect } from 'react';

// This component runs in a separate window, so it needs its own styles
const keywordsWindowStyles = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #1a1a1b;
    color: #d7dadc;
    margin: 0;
    padding: 0; /* Remove padding from body */
  }
  
  .wrapper {
    /* Make body a flex column that fills the window */
    height: 100vh;
    display: flex;
    flex-direction: column;
    box-sizing: border-box; /* Include padding in height calc */
    padding: 20px;
  }

  h2 {
    margin: 0 0 16px 0;
    border-bottom: 1px solid #4a4a4d;
    padding-bottom: 8px;
    flex-shrink: 0; /* Prevent title from shrinking */
  }
  .keywords-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;

    /* Make list fill remaining space and scroll */
    flex-grow: 1;
    overflow-y: auto;
    padding-right: 4px; /* Small space for scrollbar */
  }
  .keyword-item {
    background-color: #272728;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 14px;
    border: 1px solid #4a4a4d;
  }
`;

export default function KeywordsWindow() {
  const [keywords, setKeywords] = useState<string[]>([]);

  useEffect(() => {
    // Inject styles
    const styleTag = document.createElement('style');
    styleTag.innerHTML = keywordsWindowStyles;
    document.head.appendChild(styleTag);

    // Get last keywords on load
    window.electronAPI
      .getLastKeywords()
      .then((kws) => setKeywords(kws || []));

    // Listen for live updates
    const handleUpdate = (kws: string[]) => {
      setKeywords(kws);
    };
    window.electronAPI.onKeywordsUpdate(handleUpdate);

    return () => {
      window.electronAPI.removeAllListeners('keywords:update');
    };
  }, []);

  return (
    // Add a wrapper div to manage the flex layout correctly
    <div className="wrapper">
      <h2>Extracted Keywords</h2>
      <ul className="keywords-list">
        {keywords.length === 0 && (
          <li className="keyword-item" style={{ color: '#818384' }}>
            No keywords extracted yet.
          </li>
        )}
        {keywords.map((kw, index) => (
          <li key={index} className="keyword-item">
            {kw}
          </li>
        ))}
      </ul>
    </div>
  );
}

