import { AuthProvider } from '../auth/AuthContext';

import type { ReactNode } from 'react';

type AppProvidersProps = {
  children: ReactNode;
};

export const AppProviders = ({ children }: AppProvidersProps) => <AuthProvider>{children}</AuthProvider>;
