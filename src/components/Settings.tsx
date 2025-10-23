import React, { useState, useEffect } from 'react';

const GEMINI_MODELS = [
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash - Best Price/Performance' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite - Ultra Fast & Cost-Efficient' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro - Most Advanced (Reasoning & Complex Tasks)' },
];

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    // Load saved settings
    window.electronAPI.getApiKey().then(setApiKey);
    window.electronAPI.getStoreValue('geminiModel').then((model) => {
      if (model) setSelectedModel(model as string);
    });
  }, []);

  const handleSave = async () => {
    await window.electronAPI.setApiKey(apiKey);
    await window.electronAPI.setStoreValue('geminiModel', selectedModel);
    setSaveStatus('Settings saved successfully!');
    setTimeout(() => setSaveStatus(''), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1>Settings</h1>
      
      <div className="settings-form">
        <label
          htmlFor="api-key"
          style={{ fontWeight: 600, fontSize: '14px' }}
        >
          Google Gemini API Key
        </label>
        <input
          id="api-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter your Gemini API Key"
        />
        <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '4px' }}>
          Get your API key from{' '}
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI.openFile('https://aistudio.google.com/app/apikey');
            }}
            style={{ color: '#0066cc' }}
          >
            Google AI Studio
          </a>
        </p>
      </div>

      <div className="settings-form">
        <label
          htmlFor="model-select"
          style={{ fontWeight: 600, fontSize: '14px' }}
        >
          Gemini Model
        </label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            backgroundColor: 'white',
          }}
        >
          {GEMINI_MODELS.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
            </option>
          ))}
        </select>
        <p style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '4px' }}>
          Flash models are faster and cheaper. Pro model provides advanced reasoning for complex tasks.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={handleSave}>Save Settings</button>
        {saveStatus && (
          <span style={{ color: 'var(--color-success)', fontSize: '14px' }}>
            {saveStatus}
          </span>
        )}
      </div>

      <div style={{ fontSize: '12px', color: 'var(--color-text-dim)', marginTop: '8px' }}>
        Your settings are stored locally and securely using electron-store.
      </div>
    </div>
  );
}