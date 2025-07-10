import { useState, useEffect } from 'react';

interface TabItem {
  id: string;
  label: string;
  content?: React.ReactNode;
  children?: TabItem[];
}

interface TabProps {
  tabs: TabItem[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
}

export default function TabNavigation({ tabs, activeTabId: externalActiveTabId, onTabChange }: TabProps) {
  const [internalActiveTabId, setInternalActiveTabId] = useState(externalActiveTabId || tabs[0]?.id || '');
  const [activeChildTabId, setActiveChildTabId] = useState('');

  // Sync internal state with external state
  useEffect(() => {
    if (externalActiveTabId && externalActiveTabId !== internalActiveTabId) {
      setInternalActiveTabId(externalActiveTabId);
    }
  }, [externalActiveTabId]);

  // Use either the controlled or uncontrolled active tab ID
  const activeTabId = externalActiveTabId || internalActiveTabId;

  // Find the active tab
  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  
  // If the active tab has children and no active child is set, set the first child as active
  if (activeTab?.children && activeTab.children.length > 0 && !activeChildTabId) {
    setActiveChildTabId(activeTab.children[0].id);
  }

  // Find the active child tab if there is one
  const activeChildTab = activeTab?.children?.find((child) => child.id === activeChildTabId);

  // Handle tab change
  const handleTabChange = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else {
      setInternalActiveTabId(tabId);
    }

    // Reset child tab when changing parent tab
    if (tabs.find(tab => tab.id === tabId)?.children?.length) {
      setActiveChildTabId(tabs.find(tab => tab.id === tabId)?.children?.[0].id || '');
    } else {
      setActiveChildTabId('');
    }
  };

  return (
    <div className="tab-container">
      <div className="tab-header primary-tabs mobile-stack">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`tab-button w-full-mobile ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Show child tabs if the active tab has children */}
      {activeTab && activeTab.children && activeTab.children.length > 0 && (
        <div className="tab-header secondary-tabs mobile-stack">
          {activeTab.children.map((childTab) => (
            <button
              key={childTab.id}
              type="button"
              className={`tab-button w-full-mobile ${activeChildTabId === childTab.id ? 'active' : ''}`}
              onClick={() => setActiveChildTabId(childTab.id)}
            >
              {childTab.label}
            </button>
          ))}
        </div>
      )}
      
      <div className="tab-content">
        {activeChildTab 
          ? activeChildTab.content
          : activeTab?.content}
      </div>
    </div>
  );
} 