import { useState, FormEvent } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn } from 'lucide-react';

export function AuthPage() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const email = username.includes('@') ? username : `${username}@motovia.com`;
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid username or password.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is disabled. Please enable it in the Firebase Console.');
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-[#0a0a0a] text-slate-300 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="text-white font-serif italic text-4xl tracking-tighter">
            Motovia <span className="text-rose-600">Nepal</span>
          </div>
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-[0.2em] text-white/40">
          Premium Auto Care Admin
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white/[0.02] border border-white/5 py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Username or Email</label>
              <input 
                required 
                type="text" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" 
                placeholder="admin" 
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Password</label>
              <input 
                required 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded focus:outline-none focus:border-rose-500 text-white text-sm" 
                placeholder="••••••••" 
              />
            </div>
            {error && <div className="text-rose-500 text-xs text-center">{error}</div>}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-white/20 rounded shadow-[0_0_20px_rgba(225,20,60,0.1)] text-[10px] font-bold uppercase tracking-widest text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 text-rose-500" />
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

