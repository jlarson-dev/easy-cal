"use client";

import React from 'react';

const Tabs = ({ activeTab, onTabChange, tabs }) => {
  return (
    <div className="tabs-container">
      <div className="tabs-header">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tabs-content">
        {tabs.map((tab) => (
          <div key={tab.id} hidden={activeTab !== tab.id}>
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Tabs;

