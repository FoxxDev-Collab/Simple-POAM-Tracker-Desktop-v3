import React, { createContext, useContext } from 'react';

interface TabContextType {
  setActiveTab: (tabId: string) => void;
}

const TabContext = createContext<TabContextType>({
  setActiveTab: () => {},
});

export const useTabNavigation = () => useContext(TabContext);

interface TabProviderProps {
  children: React.ReactNode;
  setActiveTabId: (tabId: string) => void;
}

export const TabProvider: React.FC<TabProviderProps> = ({ 
  children, 
  setActiveTabId 
}) => {
  const setActiveTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  return (
    <TabContext.Provider value={{ setActiveTab }}>
      {children}
    </TabContext.Provider>
  );
}; 