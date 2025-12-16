import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-fluid-4 text-center">
      <h1 className="text-9xl font-bold text-primary-500">404</h1>
      <h2 className="mt-4 text-2xl font-semibold">Page not found</h2>
      <p className="mt-2 text-dark-400">The page you are looking for doesn't exist or has been moved.</p>
      <Link to="/" className="mt-8 btn btn-primary">
        <Home className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}