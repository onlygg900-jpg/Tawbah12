import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { Globe, Mail, User, Loader2, Sparkles, BookOpen } from 'lucide-react';

export default function LoginPage() {
  const { signInGoogle, signInEmail, signUpEmail, signInGuest, profile } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(profile.displayName || '');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setError(null);
    setLoading('google');
    const res = await signInGoogle();
    if (!res.ok && res.error) {
      setError(res.error);
      setLoading(null);
    }
  };

  const handleEmail = async () => {
    setError(null);
    setLoading('email');
    const res = mode === 'signup'
      ? await signUpEmail(email, password, name)
      : await signInEmail(email, password, name || undefined);
    if (!res.ok && res.error) {
      setError(res.error);
    }
    setLoading(null);
  };

  const handleGuest = async () => {
    setError(null);
    setLoading('guest');
    await signInGuest(name || undefined);
    setLoading(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-deep via-emerald to-emerald-deep flex items-center justify-center p-4 dir-rtl" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-3xl bg-gradient-to-br from-gold to-gold-light shadow-2xl mb-4">
            <BookOpen size={40} className="text-emerald-deep" />
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-2">توبة</h1>
          <p className="text-emerald-100 text-sm">رفيقك الروحي اليومي</p>
        </div>

        <div className="card p-6 shadow-2xl animate-fade-in">
          <div className="text-center mb-5">
            <Sparkles size={20} className="inline text-gold-light mb-1" />
            <h2 className="text-xl font-bold text-emerald dark:text-gold-light">
              مرحباً بك! سجّل الدخول للمتابعة
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              لحماية بياناتك وتتبع تقدمك
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleGoogle}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-emerald-deep border-2 border-slate-200 dark:border-emerald-soft/30 px-4 py-3 font-bold text-slate-700 dark:text-slate-100 hover:border-gold/50 hover:shadow-md transition disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading === 'google' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/>
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"/>
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"/>
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"/>
                </svg>
              )}
              المتابعة بحساب Google
            </button>

            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-emerald-soft/30" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-emerald-deep/50 px-3 text-slate-400">أو باستخدام البريد</span>
              </div>
            </div>

            <div className="rounded-xl bg-emerald dark:bg-emerald-soft/40 p-1 mb-2">
              <div className="flex gap-1">
                <button
                  onClick={() => { setMode('login'); setError(null); }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    mode === 'login' ? 'bg-white dark:bg-emerald-deep text-emerald dark:text-gold-light shadow' : 'text-white/80 dark:text-slate-300'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(null); }}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                    mode === 'signup' ? 'bg-white dark:bg-emerald-deep text-emerald dark:text-gold-light shadow' : 'text-white/80 dark:text-slate-300'
                  }`}
                >
                  حساب جديد
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="mb-1 block text-xs font-semibold">الاسم</label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: محمد"
                    className="input pr-9"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@mail.com"
                  className="input pr-9"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold">كلمة المرور</label>
              <div className="relative">
                <Globe className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input pr-9"
                />
              </div>
            </div>

            <button
              onClick={handleEmail}
              disabled={loading !== null || !email.trim() || password.length < 4 || (mode === 'signup' && !name.trim())}
              className="btn-primary w-full py-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading === 'email' ? <Loader2 size={18} className="animate-spin mx-auto" /> : (mode === 'signup' ? 'إنشاء الحساب' : 'تسجيل الدخول')}
            </button>

            <button
              onClick={handleGuest}
              disabled={loading !== null}
              className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald dark:hover:text-gold-light py-2 transition disabled:opacity-60"
            >
              {loading === 'guest' ? (
                <Loader2 size={16} className="animate-spin mx-auto inline mr-1" />
              ) : null}
              المتابعة كضيف (حفظ محلي فقط)
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-emerald-200/80">
          بالمتابعة، أنت توافق على استخدام بياناتك لتتبع تقدمك في عباداتك
        </p>
      </div>
    </div>
  );
}
