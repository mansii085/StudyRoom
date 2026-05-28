import { Switch, Route } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import Lobby from '@/pages/Lobby';
import Room from '@/pages/Room';
import Dashboard from '@/pages/Dashboard';
import Join from '@/pages/Join';

import { Background3D } from '@/components/Background3D';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/join/:code" component={Join} />
      <Route path="/rooms/:id" component={Room} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/" component={Lobby} />
      <Route component={Lobby} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <Background3D />
            <Router />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
