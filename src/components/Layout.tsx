import React from 'react';
import { NavLink } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="app-layout">
      <nav className="sidebar">
        <NavLink
          to="/"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Generate
        </NavLink>
        <NavLink
          to="/documents"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          My Documents
        </NavLink>
        <NavLink
          to="/settings"
          className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
        >
          Settings
        </NavLink>
      </nav>
      <main className="main-content">{children}</main>
    </div>
  );
}
