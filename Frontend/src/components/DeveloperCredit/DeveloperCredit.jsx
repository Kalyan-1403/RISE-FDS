import React from 'react';
import './DeveloperCredit.css';

const DeveloperCredit = () => {
  return (
    <a
      href="https://www.linkedin.com/in/j-siva-kalyan-naik"
      target="_blank"
      rel="noopener noreferrer"
      className="dev-credit"
    >
      <span className="dev-icon">👨‍💻</span>
      <span className="dev-text">
        Crafted with 💖 by <strong>J Siva Kalyan Naik</strong>
      </span>
      <span className="dev-sparkle">✨</span>
    </a>
  );
};

export default DeveloperCredit;
