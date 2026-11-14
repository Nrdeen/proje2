import { useState } from 'react';

interface AuthViewProps {
  /** Shown when the visitor was sent here because an action needs an account. */
  reason?: string;
  onLogin: (phone: string, password: string) => Promise<void>;
  onRegister: (name: string, phone: string, password: string, role: 'buyer' | 'seller') => Promise<void>;
}

const fieldCls =
  'h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/75 focus:outline-none focus:border-[var(--color-green-ink)]';

export function AuthView({ reason, onLogin, onRegister }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'seller'>('buyer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') {
        await onLogin(phone.trim(), password);
      } else {
        await onRegister(name.trim(), phone.trim(), password, role);
      }
      setPassword('');
    } catch (err: any) {
      setError(err?.message || 'تعذر إكمال العملية');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-lg mx-auto px-4 sm:px-6 py-12">
      <form
        onSubmit={submit}
        className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 space-y-4"
      >
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--color-ink)]">
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </h1>
          <p className="text-xs text-[var(--color-muted)] mt-1">
            {reason ||
              (mode === 'login'
                ? 'ادخل برقم الجوال وكلمة المرور للوصول إلى حسابك.'
                : 'أنشئ حساباً برقم الجوال السعودي للتسوق أو عرض مواشيك.')}
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3">
          {mode === 'register' && (
            <input
              type="text"
              placeholder="الاسم الكامل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              required
              className={fieldCls}
            />
          )}
          <input
            type="tel"
            placeholder="05XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            inputMode="tel"
            required
            className={`${fieldCls} tabular-nums`}
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 10 : undefined}
            required
            className={fieldCls}
          />
          {mode === 'register' && (
            <>
              <p className="text-xs text-[var(--color-muted)] -mt-1">كلمة المرور 10 أحرف على الأقل.</p>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'buyer' | 'seller')}
                className={fieldCls}
              >
                <option value="buyer">حساب مشتري</option>
                <option value="seller">حساب مربي / بائع</option>
              </select>
            </>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full h-11 rounded-lg bg-[var(--color-green)] hover:bg-[var(--color-green-hover)] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
        >
          {busy ? 'جاري التنفيذ...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
          className="w-full text-xs font-semibold text-[var(--color-green-ink)] hover:underline cursor-pointer"
        >
          {mode === 'login' ? 'ليس لديك حساب؟ أنشئ حساباً جديداً' : 'لديك حساب؟ سجّل الدخول'}
        </button>
      </form>
    </section>
  );
}
