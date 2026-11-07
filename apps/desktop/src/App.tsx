import React from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { HomeScreen } from './screens/HomeScreen';

export const App: React.FC = () => {
  return (
    <MainLayout>
      <HomeScreen />
    </MainLayout>
  );
};

export default App;

