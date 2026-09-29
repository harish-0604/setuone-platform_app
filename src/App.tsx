/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { LanguageProvider } from './contexts/LanguageContext.tsx';
import { RoleGuard } from './components/auth/RoleGuard.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { StudentDashboardPage } from './pages/StudentDashboardPage.tsx';
import { GuardianDashboardPage } from './pages/GuardianDashboardPage.tsx';
import { OfficerDashboardPage } from './pages/OfficerDashboardPage.tsx';
import { PresenterPage } from './pages/PresenterPage.tsx';

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Normal Production-Facing Prototype Login Route */}
            <Route path="/" element={<LoginPage />} />

            {/* Role-Protected Dashboards */}
            <Route
              path="/student"
              element={
                <RoleGuard allowedRole="student">
                  <StudentDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/guardian"
              element={
                <RoleGuard allowedRole="guardian">
                  <GuardianDashboardPage />
                </RoleGuard>
              }
            />
            <Route
              path="/officer"
              element={
                <RoleGuard allowedRole="officer">
                  <OfficerDashboardPage />
                </RoleGuard>
              }
            />

            {/* Hidden Presenter & Evaluation Route — Accessible by Direct URL Only */}
            <Route path="/presenter" element={<PresenterPage />} />

            {/* Catch-all Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
