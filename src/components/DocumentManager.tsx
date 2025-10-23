import React, { useState, useEffect } from 'react';

type Document = {
  id: string;
  type: 'resume' | 'coverLetter';
  company: string;
  position: string;
  texPath: string;
  pdfPath: string;
  filePath: string;
  date: string;
  createdAt: string;
};

export default function DocumentManager() {
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    async function fetchDocuments() {
      const docs = await window.electronAPI.getDocuments();
      // Sort by date, newest first
      docs.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setDocuments(docs);
    }
    fetchDocuments();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1>My Generated Documents</h1>
      <ul className="document-list">
        {documents.length === 0 && (
          <p style={{ color: 'var(--color-text-dim)' }}>
            No documents generated yet.
          </p>
        )}
        {documents.map((doc) => (
          <li key={doc.id} className="document-item">
            <div className="document-item-info">
              <strong>
                {doc.type === 'resume' ? 'Resume' : 'Cover Letter'} -{' '}
                {doc.position}
              </strong>
              <span>
                For: {doc.company} | Generated:{' '}
                {new Date(doc.createdAt).toLocaleDateString()}
              </span>
            </div>
            <button onClick={() => window.electronAPI.openFile(doc.filePath)}>
              Open PDF
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}