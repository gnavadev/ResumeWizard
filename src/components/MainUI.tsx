import React, { useState, useEffect } from 'react';

type Template = {
  filePath?: string;
  content: string;
  name: string;
};

type Status = {
  type: 'loading' | 'error' | 'success' | 'idle';
  message: string;
};

export default function MainUI() {
  const [jobDescription, setJobDescription] = useState('');
  const [company, setCompany] = useState('');
  const [position, setPosition] = useState('');
  const [resumeTemplate, setResumeTemplate] = useState<Template | null>(null);
  const [coverTemplate, setCoverTemplate] = useState<Template | null>(null);
  const [status, setStatus] = useState<Status>({ type: 'idle', message: '' });

  useEffect(() => {
    async function loadSavedState() {
      const savedJobDescription = await window.electronAPI.getStoreValue('draft_jobDescription');
      const savedCompany = await window.electronAPI.getStoreValue('draft_company');
      const savedPosition = await window.electronAPI.getStoreValue('draft_position');
      const savedResumeTemplate = await window.electronAPI.getStoreValue('draft_resumeTemplate');
      const savedCoverTemplate = await window.electronAPI.getStoreValue('draft_coverTemplate');

      if (savedJobDescription) setJobDescription(savedJobDescription as string);
      if (savedCompany) setCompany(savedCompany as string);
      if (savedPosition) setPosition(savedPosition as string);
      if (savedResumeTemplate) setResumeTemplate(savedResumeTemplate as Template);
      if (savedCoverTemplate) setCoverTemplate(savedCoverTemplate as Template);
    }
    loadSavedState();
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    window.electronAPI.setStoreValue('draft_jobDescription', jobDescription);
  }, [jobDescription]);

  useEffect(() => {
    window.electronAPI.setStoreValue('draft_company', company);
  }, [company]);

  useEffect(() => {
    window.electronAPI.setStoreValue('draft_position', position);
  }, [position]);

  useEffect(() => {
    window.electronAPI.setStoreValue('draft_resumeTemplate', resumeTemplate);
  }, [resumeTemplate]);

  useEffect(() => {
    window.electronAPI.setStoreValue('draft_coverTemplate', coverTemplate);
  }, [coverTemplate]);

  // --- Effects for OCR & Paste ---
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Fix: Add null check for clipboardData
      if (!event.clipboardData) return;

      const items = event.clipboardData.items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          setStatus({ type: 'loading', message: 'Processing screenshot...' });
          const blob = item.getAsFile();

          // Fix: Add null check for blob
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (e) => {
            // Fix: Add null check for e.target
            if (!e.target) return;

            const base64Image = e.target.result as string;
            window.electronAPI.processImage(base64Image);
          };
          reader.readAsDataURL(blob);
        }
      }
    };

    const handleOcrResult = (text: string) => {
      if (text.startsWith('Error:')) {
        setStatus({ type: 'error', message: text });
      } else {
        setJobDescription(text);
        setStatus({
          type: 'success',
          message: 'Screenshot processed successfully.',
        });
      }
    };

    window.addEventListener('paste', handlePaste);
    window.electronAPI.onOcrResult(handleOcrResult);

    return () => {
      window.removeEventListener('paste', handlePaste);
      window.electronAPI.removeAllListeners('ocr:result');
    };
  }, []);

  // --- Handlers ---
  const handleUploadTemplate = async (
    setter: React.Dispatch<React.SetStateAction<Template | null>>
  ) => {
    const template = await window.electronAPI.uploadTemplate();
    if (template) {
      setter(template);
    }
  };

  const handleGenerate = async (type: 'resume' | 'cover-letter') => {
    const template = type === 'resume' ? resumeTemplate : coverTemplate;
    if (!template) {
      setStatus({ type: 'error', message: `Please select a ${type} template.` });
      return;
    }
    if (!jobDescription) {
      setStatus({ type: 'error', message: 'Please paste a job description.' });
      return;
    }

    setStatus({ type: 'loading', message: `Generating ${type}...` });

    const options = {
      type,
      jobDescription,
      resumeTemplate: type === 'resume' ? resumeTemplate : null,
      coverLetterTemplate: type === 'cover-letter' ? coverTemplate : null,
    };

    const result = await window.electronAPI.generateDoc(options);

    if (result.success) {
      setStatus({
        type: 'success',
        message: `${type.charAt(0).toUpperCase() + type.slice(1)} generated successfully!`,
      });
      // Automatically open keywords window on resume success
      if (type === 'resume') {
        window.electronAPI.openWindow('keywords');
      }
    } else {
      setStatus({ type: 'error', message: `Error: ${result.error}` });
    }
  };

  return (
    <div className="main-ui-grid">
      <div className="job-description-col">
        <h2>Job Description</h2>
        <p style={{ margin: 0, color: 'var(--color-text-dim)' }}>
          Paste the job text directly, or paste a screenshot of the job post.
        </p>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste job description text or screenshot here..."
        />
        {status.type !== 'idle' && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>

      <div className="controls-col">
        <div className="control-group">
          <h3>Job Details</h3>
          <input
            type="text"
            placeholder="Company Name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            type="text"
            placeholder="Position / Job Title"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </div>

        <div className="control-group">
          <h3>Templates</h3>
          <button onClick={() => handleUploadTemplate(setResumeTemplate)}>
            Select Resume Template
          </button>
          <span className="template-label">
            {resumeTemplate?.name || 'No file selected'}
          </span>
          <button onClick={() => handleUploadTemplate(setCoverTemplate)}>
            Select Cover Letter Template
          </button>
          <span className="template-label">
            {coverTemplate?.name || 'No file selected'}
          </span>
        </div>

        <div className="control-group">
          <h3>Generate</h3>
          <button
            onClick={() => handleGenerate('resume')}
            disabled={!resumeTemplate || !jobDescription || status.type === 'loading'}
          >
            Generate Resume
          </button>
          <button
            onClick={() => handleGenerate('cover-letter')}
            disabled={!coverTemplate || !jobDescription || status.type === 'loading'}
          >
            Generate Cover Letter
          </button>
        </div>
      </div>
    </div>
  );
}