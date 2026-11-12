import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import Layout from './components/Layout';
import Overview from './pages/Overview';
import VoiceAssistantPage from './pages/VoiceAssistantPage';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import LeadsPage from './pages/LeadsPage';
import ConversationsPage from './pages/ConversationsPage';
import FollowUpsPage from './pages/FollowUpsPage';
import SettingsPage from './pages/SettingsPage';
import {
  LenisProvider,
  RouteTransition,
  FirstVisitLoader,
  ScrollProgressBar,
} from './motion';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <RouteTransition>
      <Routes location={location}>
        <Route path="/" element={<Overview />} />
        <Route path="/voice-assistant" element={<VoiceAssistantPage />} />
        <Route path="/properties" element={<PropertiesPage />} />
        <Route path="/properties/:propertyId" element={<PropertyDetailPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/conversations" element={<ConversationsPage />} />
        <Route path="/followups" element={<FollowUpsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RouteTransition>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <LenisProvider>
        <BrowserRouter>
          <FirstVisitLoader />
          <ScrollProgressBar />
          <Layout>
            <AnimatedRoutes />
          </Layout>
        </BrowserRouter>
      </LenisProvider>
    </MotionConfig>
  );
}
