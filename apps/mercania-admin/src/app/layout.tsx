import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Mercania WMS - Admin Dashboard',
  description: 'Inventory management system for second-hand media store',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-50">
              {children}
            </div>
          </ProtectedRoute>
        </AuthProvider>
      </body>
    </html>
  );
}
