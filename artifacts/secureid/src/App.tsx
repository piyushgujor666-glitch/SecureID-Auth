import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useForgotPassword,
  useGetMe,
  useHealthCheck,
  useLogin,
  useLogout,
  useRegister,
  useResendOtp,
  useResetPassword,
  useSendOtp,
  useVerifyOtp,
} from '@workspace/api-client-react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UserRound,
  X,
} from 'lucide-react';
import {
  Link,
  Route,
  Switch,
  useLocation,
  useParams,
  Router as WouterRouter,
} from 'wouter';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
type Notice = { kind: 'error' | 'success' | 'info'; text: string };
type Registration = { firstName: string; lastName: string; email: string; mobile: string; password: string };
type RegistrationSnapshot = Pick<Registration, 'firstName' | 'lastName' | 'email' | 'mobile'>;

const readRegistration = (): RegistrationSnapshot | null => {
  try { return JSON.parse(sessionStorage.getItem('secureid_registration') ?? 'null') as RegistrationSnapshot | null; } catch { return null; }
};
const saveRegistration = (data: Registration) => {
  const safeData: RegistrationSnapshot = {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    mobile: data.mobile,
  };
  sessionStorage.setItem('secureid_registration', JSON.stringify(safeData));
};
const errorText = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
};
const formatTime = (seconds: number) => `0:${String(seconds).padStart(2, '0')}`;
const maskEmail = (email: string) => email ? email.replace(/^(.{2})(.*)(@.*)$/, '$1•••$3') : 'your email';
const maskMobile = (mobile: string) => mobile ? `${mobile.slice(0, 3)} ••• ••${mobile.slice(-2)}` : 'your mobile';

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <Link href="/" className={`inline-flex items-center gap-2.5 ${inverse ? 'text-[#f7f3e9]' : 'text-[#18222e]'}`} data-testid="link-logo">
    <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-[#dc694e] text-[#fff8ec] shadow-sm"><ShieldCheck size={20} strokeWidth={2.5} /></span>
    <span className="font-mono text-[15px] font-bold tracking-[-.04em]">secure<span className={inverse ? 'text-[#dc8a74]' : 'text-[#1c5960]'}>id</span></span>
  </Link>;
}

function NoticeBox({ notice, onDismiss }: { notice?: Notice | null; onDismiss?: () => void }) {
  if (!notice) return null;
  const tone = notice.kind === 'error' ? 'border-[#e6b9af] bg-[#fff3ef] text-[#8b3f33]' : notice.kind === 'success' ? 'border-[#b7d2c6] bg-[#eef8f1] text-[#245d43]' : 'border-[#b6d6d7] bg-[#edf7f7] text-[#245d63]';
  return <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${tone}`} role="alert" data-testid={`status-${notice.kind}`}>
    {notice.kind === 'error' ? <CircleAlert size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}
    <p className="flex-1 leading-5">{notice.text}</p>
    {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss message" data-testid="button-dismiss-notice"><X size={15} /></button>}
  </div>;
}

function PasswordRequirement({ label, met }: { label: string; met: boolean }) {
  return <li className={`flex items-center gap-2 ${met ? 'text-[#397b61]' : 'text-[#737b76]'}`}>
    <span className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${met ? 'border-[#78b296] bg-[#e4f2e7]' : 'border-[#c9c5ba] bg-[#f8f6f0]'}`} aria-hidden="true">
      {met ? <Check size={10} strokeWidth={3} /> : <X size={10} />}
    </span>
    <span>{label}</span>
  </li>;
}

function Button({ children, variant = 'primary', className = '', disabled = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const styles = variant === 'primary' ? 'bg-[#1c5960] text-[#fff8ec] hover:bg-[#16484e] shadow-[0_7px_18px_rgba(28,89,96,.15)]' : variant === 'secondary' ? 'border border-[#cfc9bb] bg-[#f8f5ed] text-[#26313a] hover:bg-[#efebe1]' : 'text-[#1c5960] hover:bg-[#e4efed]';
  return <button disabled={disabled} className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`} {...props}>{children}</button>;
}

function PageFrame({ children, aside = true }: { children: ReactNode; aside?: boolean }) {
  return <div className="secure-noise min-h-[100dvh] bg-[#f5f3ed]">
    <div className="mx-auto grid min-h-[100dvh] max-w-[1440px] lg:grid-cols-[minmax(300px,34%)_1fr]">
      {aside && <aside className="relative hidden overflow-hidden bg-[#18222e] px-10 py-10 text-[#f7f3e9] lg:flex lg:flex-col">
        <div className="absolute -right-28 top-28 h-72 w-72 rounded-full border border-[#7f9994]/20" />
        <div className="absolute -right-12 top-44 h-40 w-40 rounded-full border border-[#dc694e]/40" />
        <Logo inverse />
        <div className="relative mt-auto max-w-[340px] pb-5 animate-rise">
          <div className="mb-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.18em] text-[#8caeaa]"><span className="h-px w-8 bg-[#dc694e]" />private by design</div>
          <h2 className="font-mono text-4xl font-bold leading-[1.06] tracking-[-.07em]">Your account,<br /><span className="text-[#dc8a74]">kept yours.</span></h2>
          <p className="mt-6 max-w-[290px] text-[14px] leading-6 text-[#b4c0bd]">SecureID keeps the important things simple: one identity, clearly verified, always in your hands.</p>
        </div>
        <div className="relative mt-8 flex items-center gap-2 text-[11px] text-[#80918f]"><span className="h-2 w-2 rounded-full bg-[#75bda6]" /> encrypted session <span className="ml-1 text-[#596d6e]">/</span> v1.0</div>
      </aside>}
      <main className="relative flex min-h-[100dvh] flex-col">
        <header className="flex items-center justify-between px-5 py-6 sm:px-8 lg:px-14"><Logo /><div className="flex items-center gap-2 text-[12px] text-[#68726f]"><LockKeyhole size={14} /> protected connection</div></header>
        <div className="flex flex-1 items-start justify-center px-5 pb-12 pt-6 sm:px-8 sm:pt-12 lg:px-14">{children}</div>
      </main>
    </div>
  </div>;
}

function Field({ label, id, type = 'text', value, onChange, placeholder, error, autoComplete, trailing }: { label: string; id: string; type?: string; value: string; onChange: (value: string) => void; placeholder?: string; error?: string; autoComplete?: string; trailing?: ReactNode }) {
  return <label className="block" htmlFor={id}><span className="mb-2 block text-[12px] font-bold uppercase tracking-[.08em] text-[#596563]">{label}</span>
    <span className="relative block"><input id={id} data-testid={`input-${id}`} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={Boolean(error)} className={`h-12 w-full rounded-xl border bg-[#fbfaf6] px-4 text-[15px] text-[#18222e] outline-none transition focus:border-[#1c5960] focus:ring-4 focus:ring-[#1c5960]/10 ${trailing ? 'pr-12' : ''} ${error ? 'border-[#c65d4d]' : 'border-[#d5d0c4]'}`} />{trailing}</span>
    {error && <span className="mt-1.5 block text-[12px] text-[#a94b3e]" data-testid={`error-${id}`}>{error}</span>}
  </label>;
}

function AuthTop({ eyebrow, title, body, step, total = 3 }: { eyebrow: string; title: ReactNode; body: string; step?: number; total?: number }) {
  return <div className="animate-rise"><div className="mb-6 flex items-center justify-between"><span className="font-mono text-[11px] font-bold uppercase tracking-[.18em] text-[#1c5960]">{eyebrow}</span>{step && <span className="font-mono text-[11px] text-[#7b827d]">{String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>}</div><h1 className="font-mono text-[clamp(2rem,5vw,3.3rem)] font-bold leading-[1.05] tracking-[-.07em] text-[#18222e]">{title}</h1><p className="mt-5 max-w-[450px] text-[15px] leading-6 text-[#6a736f]">{body}</p></div>;
}

function Home() {
  const health = useHealthCheck();
  return <div className="secure-noise min-h-[100dvh] overflow-hidden bg-[#f5f3ed]"><div className="mx-auto max-w-[1440px]">
    <header className="flex items-center justify-between px-5 py-6 sm:px-10 lg:px-16"><Logo /><div className="flex items-center gap-5"><span className="hidden text-[12px] text-[#68726f] sm:block">Account protection, without the noise.</span><Link href="/login" className="text-[13px] font-semibold text-[#1c5960] hover:underline" data-testid="link-login-header">Sign in <ArrowRight size={14} className="ml-1 inline" /></Link></div></header>
    <section className="grid min-h-[calc(100dvh-86px)] items-center gap-12 px-5 pb-16 pt-8 sm:px-10 lg:grid-cols-[1.12fr_.88fr] lg:px-16 lg:pb-24">
      <div className="animate-rise"><div className="mb-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[.2em] text-[#1c5960]"><span className="h-px w-9 bg-[#dc694e]" /> welcome to secureid</div>
        <h1 className="max-w-[740px] font-mono text-[clamp(3.2rem,8vw,7.2rem)] font-bold leading-[.92] tracking-[-.1em] text-[#18222e]">A quieter<br /><span className="text-[#1c5960]">way in.</span></h1>
        <p className="mt-8 max-w-[480px] text-[17px] leading-7 text-[#67716e]">Create one account for the things that matter. Verify your identity in a few clear steps, then get on with your day.</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row"><Link href="/register" className="inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[#dc694e] px-6 text-[14px] font-bold text-[#fff8ec] shadow-[0_10px_25px_rgba(220,105,78,.18)] transition hover:bg-[#c85b43]" data-testid="link-create-account">Create your account <ArrowRight size={17} /></Link><Link href="/login" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-[#cfc9bb] bg-[#f8f5ed] px-6 text-[14px] font-bold text-[#26313a] transition hover:bg-[#ede9df]" data-testid="link-login">I already have an account</Link></div>
        <div className="mt-12 flex items-center gap-3 text-[12px] text-[#78817d]" data-testid="status-health"><span className={`h-2 w-2 rounded-full ${health.isError ? 'bg-[#c65d4d]' : 'bg-[#75bda6]'}`} /> {health.isError ? 'service check unavailable' : 'all systems operational'} <span className="text-[#b1ada4]">·</span> encrypted in transit</div>
      </div>
      <div className="relative mx-auto w-full max-w-[440px] animate-rise animate-rise-2"><div className="grid-paper absolute inset-8 rounded-[40px] opacity-70" />
        <div className="relative overflow-hidden rounded-[28px] border border-[#d2cdc0] bg-[#ebe8de] p-5 shadow-[0_24px_65px_rgba(26,38,48,.12)]"><div className="flex items-center justify-between border-b border-[#d0cabd] pb-5"><span className="font-mono text-[11px] font-bold uppercase tracking-[.16em] text-[#65716d]">identity / 01</span><span className="font-mono text-[11px] text-[#9b9c91]">SEC-2401</span></div><div className="py-10"><div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-[#7aa7a2] bg-[#d5e6df] text-[#1c5960]"><Fingerprint size={57} strokeWidth={1.15} /></div><p className="mt-7 text-center font-mono text-[15px] font-bold tracking-[-.03em] text-[#18222e]">identity confirmed</p><div className="mx-auto mt-6 h-px w-20 bg-[#dc694e]" /></div><div className="grid grid-cols-3 gap-2 border-t border-[#d0cabd] pt-5 text-center"><div><p className="font-mono text-[16px] font-bold text-[#18222e]">2FA</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#78817d]">ready</p></div><div><p className="font-mono text-[16px] font-bold text-[#18222e]">AES</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#78817d]">secured</p></div><div><p className="font-mono text-[16px] font-bold text-[#18222e]">24/7</p><p className="mt-1 text-[10px] uppercase tracking-[.1em] text-[#78817d]">guarded</p></div></div></div>
      </div>
    </section>
  </div></div>;
}

function Register() {
  const [, setLocation] = useLocation();
  const register = useRegister();
  const [form, setForm] = useState<Registration>({ firstName: '', lastName: '', email: '', mobile: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const requirements = useMemo(() => ({
    length: form.password.length >= 8,
    uppercase: /[A-Z]/.test(form.password),
    lowercase: /[a-z]/.test(form.password),
    number: /[0-9]/.test(form.password),
    special: /[^A-Za-z0-9]/.test(form.password),
  }), [form.password]);
  const strength = Object.values(requirements).filter(Boolean).length;
  const update = (key: keyof Registration, value: string) => { setForm((old) => ({ ...old, [key]: value })); setErrors((old) => ({ ...old, [key]: '' })); };
  const submit = (event: FormEvent) => {
    event.preventDefault(); const next: Record<string, string> = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required.'; if (!form.lastName.trim()) next.lastName = 'Last name is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'; if (!/^\+?[0-9\s()-]{7,20}$/.test(form.mobile)) next.mobile = 'Enter a valid mobile number.';
    if (strength < 3) next.password = 'Password must be at least Medium strength.';
    if (Object.keys(next).length) { setErrors(next); setNotice({ kind: 'error', text: 'Check the highlighted fields before continuing.' }); return; }
    setNotice(null); register.mutate({ data: form }, { onSuccess: (result) => { saveRegistration(form); if (result.devCode) sessionStorage.setItem('secureid_dev_email_code', result.devCode); setLocation('/verify-email'); }, onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'We could not create your account. Try a different email.') }) });
  };
  return <PageFrame><div className="w-full max-w-[570px]"><AuthTop eyebrow="01 / create identity" title={<>Make it <span className="text-[#1c5960]">yours.</span></>} body="Start with the basics. You will verify your email and mobile before your account is ready." step={1} /><form className="mt-10 space-y-5 animate-rise animate-rise-1" onSubmit={submit} noValidate>
    <div className="grid gap-5 sm:grid-cols-2"><Field label="First name" id="first-name" value={form.firstName} onChange={(value) => update('firstName', value)} placeholder="Avery" error={errors.firstName} autoComplete="given-name" /><Field label="Last name" id="last-name" value={form.lastName} onChange={(value) => update('lastName', value)} placeholder="Morgan" error={errors.lastName} autoComplete="family-name" /></div>
    <Field label="Email address" id="email" type="email" value={form.email} onChange={(value) => update('email', value)} placeholder="you@domain.com" error={errors.email} autoComplete="email" />
    <Field label="Mobile number" id="mobile" type="tel" value={form.mobile} onChange={(value) => update('mobile', value)} placeholder="+1 415 555 0138" error={errors.mobile} autoComplete="tel" />
    <div><Field label="Password" id="password" type={showPassword ? 'text' : 'password'} value={form.password} onChange={(value) => update('password', value)} placeholder="Create a private password" error={errors.password} autoComplete="new-password" trailing={<button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 p-1 text-[#6b7470]" aria-label={showPassword ? 'Hide password' : 'Show password'} data-testid="button-toggle-password">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>} />
      <div className="mt-3" aria-live="polite"><div className="flex gap-1.5">{[0, 1, 2, 3, 4].map((item) => <span key={item} className={`h-1 flex-1 rounded-full ${strength > item ? strength === 5 ? 'bg-[#4d8b73]' : 'bg-[#dc694e]' : 'bg-[#dfdcd3]'}`} />)}</div><div className="mt-2 flex items-center justify-between text-[11px] text-[#77807c]"><span data-testid="text-password-strength">{!form.password ? 'password strength' : strength <= 2 ? 'Weak' : strength <= 4 ? 'Medium' : 'Strong'}</span><span>minimum: Medium</span></div></div>
    </div>
    <div className="rounded-xl border border-[#ddd8cc] bg-[#efede5] px-4 py-3 text-[12px] leading-5"><p className="mb-2 font-semibold text-[#4e5c58]">Password requirements</p><ul className="grid gap-1.5 sm:grid-cols-2" aria-label="Password requirements"><PasswordRequirement label="At least 8 characters" met={requirements.length} /><PasswordRequirement label="One uppercase letter" met={requirements.uppercase} /><PasswordRequirement label="One lowercase letter" met={requirements.lowercase} /><PasswordRequirement label="One number" met={requirements.number} /><PasswordRequirement label="One special character" met={requirements.special} /></ul></div>
    <NoticeBox notice={notice} onDismiss={() => setNotice(null)} /><Button type="submit" className="w-full" disabled={register.isPending}>{register.isPending ? 'Creating secure account…' : 'Continue to email verification'} <ArrowRight size={17} /></Button>
    <p className="text-center text-[13px] text-[#737b76]">Already have an account? <Link href="/login" className="font-bold text-[#1c5960] hover:underline" data-testid="link-register-login">Sign in</Link></p>
  </form></div></PageFrame>;
}

function OtpBoxes({ value, setValue, disabled = false }: { value: string; setValue: (value: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const updateDigit = (index: number, digit: string) => { const next = digits.map((item) => item.trim()); next[index] = digit.replace(/\D/g, '').slice(-1); setValue(next.join('')); if (digit && index < 5) refs.current[index + 1]?.focus(); };
  const onKey = (index: number, key: string) => { if (key === 'Backspace' && !digits[index].trim() && index > 0) refs.current[index - 1]?.focus(); };
  const onPaste = (event: React.ClipboardEvent) => { event.preventDefault(); setValue(event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)); refs.current[Math.min(5, event.clipboardData.getData('text').replace(/\D/g, '').length)]?.focus(); };
  return <div className="flex gap-2.5 sm:gap-3" onPaste={onPaste}>{digits.map((digit, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} inputMode="numeric" maxLength={1} value={digit.trim()} disabled={disabled} onChange={(event) => updateDigit(index, event.target.value)} onKeyDown={(event) => onKey(index, event.key)} aria-label={`Verification digit ${index + 1}`} data-testid={`input-otp-${index + 1}`} className="h-14 min-w-0 flex-1 rounded-xl border border-[#d2cdc0] bg-[#fbfaf6] text-center font-mono text-xl font-bold text-[#18222e] outline-none transition focus:border-[#1c5960] focus:ring-4 focus:ring-[#1c5960]/10 disabled:opacity-60 sm:h-16" />)}</div>;
}

function OtpPage({ type }: { type: 'email' | 'mobile' }) {
  const [, setLocation] = useLocation(); const registration = readRegistration(); const email = registration?.email ?? '';
  const verify = useVerifyOtp(); const resend = useResendOtp(); const sendOtp = useSendOtp();
  const [code, setCode] = useState(''); const [seconds, setSeconds] = useState(59); const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => { const timer = window.setInterval(() => setSeconds((value) => value > 0 ? value - 1 : 0), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!registration) setLocation('/register'); }, [registration, setLocation]);
  if (!registration) return null;
  const label = type === 'email' ? 'email' : 'mobile'; const destination = type === 'email' ? maskEmail(email) : maskMobile(registration.mobile);
  const devCode = sessionStorage.getItem(`secureid_dev_${type}_code`);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) { setNotice({ kind: 'error', text: 'Enter all six digits to continue.' }); return; }
    setNotice(null);
    verify.mutate({ data: { email, type, code } }, {
      onSuccess: (result) => {
        if (!result.success) { setNotice({ kind: 'error', text: result.message || 'That code is not valid.' }); return; }
        sessionStorage.removeItem(`secureid_dev_${type}_code`);
        if (type === 'email') {
          sendOtp.mutate({ data: { email, type: 'mobile' } }, {
            onSuccess: (mobileResult) => {
              if (!mobileResult.success) { setNotice({ kind: 'error', text: mobileResult.message || 'We could not send the mobile code.' }); return; }
              if (mobileResult.devCode) sessionStorage.setItem('secureid_dev_mobile_code', mobileResult.devCode);
              setLocation('/verify-mobile');
            },
            onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'We could not send the mobile code.') }),
          });
        } else {
          setLocation('/authenticator');
        }
      },
      onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'That code was not accepted. It may be expired.') }),
    });
  };
  const resendCode = () => { if (seconds > 0 || resend.isPending) return; setNotice(null); resend.mutate({ data: { email, type } }, { onSuccess: (result) => { if (result.devCode) sessionStorage.setItem(`secureid_dev_${type}_code`, result.devCode); setSeconds(59); setCode(''); setNotice({ kind: 'success', text: 'A fresh code is on its way.' }); }, onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'We could not send a new code.') }) }); };
  return <PageFrame><div className="w-full max-w-[510px]"><button type="button" onClick={() => setLocation(type === 'email' ? '/register' : '/verify-email')} className="mb-12 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.1em] text-[#6b7571] hover:text-[#1c5960]" data-testid="button-back"><ArrowLeft size={15} /> Back</button><AuthTop eyebrow={`${type === 'email' ? '02' : '03'} / verify ${label}`} title={<>Check your <span className="text-[#1c5960]">{label}.</span></>} body={`We sent a six-digit code to ${destination}. It expires shortly. Keep this window open while you retrieve it.`} step={type === 'email' ? 2 : 3} /><form onSubmit={submit} className="mt-10 animate-rise animate-rise-1"><OtpBoxes value={code} setValue={setCode} disabled={verify.isPending || sendOtp.isPending} />{devCode && <p className="mt-4 rounded-lg border border-[#d5d0c4] bg-[#efede5] px-3 py-2 text-center font-mono text-[11px] text-[#596563]" data-testid="text-development-code">Development code: {devCode}</p>}<div className="mt-5 flex items-center justify-between text-[12px]"><span className="font-mono text-[#7c837e]" data-testid="text-otp-countdown">{seconds > 0 ? `code expires in ${formatTime(seconds)}` : 'code expired'}</span><button type="button" disabled={seconds > 0 || resend.isPending} onClick={resendCode} className="font-bold text-[#1c5960] disabled:text-[#9ba09b]" data-testid="button-resend-otp">{resend.isPending ? 'Sending…' : 'Resend code'}</button></div><div className="mt-8"><NoticeBox notice={notice} onDismiss={() => setNotice(null)} /></div><Button type="submit" className="mt-5 w-full" disabled={verify.isPending || sendOtp.isPending}>{verify.isPending || sendOtp.isPending ? 'Checking code…' : `Verify ${label}`} <ArrowRight size={17} /></Button><p className="mt-5 text-center text-[12px] leading-5 text-[#7a817c]">Can’t find it? Check your spam folder or request a new code when the timer ends.</p></form></div></PageFrame>;
}

function Authenticator() {
  const [, setLocation] = useLocation(); const registration = readRegistration(); const [code, setCode] = useState(''); const [notice, setNotice] = useState<Notice | null>(null); const [showKey, setShowKey] = useState(false);
  if (!registration) return null;
  const submit = (event: FormEvent) => { event.preventDefault(); if (code.length !== 6) { setNotice({ kind: 'error', text: 'Enter the six-digit code from your authenticator.' }); return; } setLocation('/success'); };
  return <PageFrame><div className="w-full max-w-[560px]"><AuthTop eyebrow="04 / authenticator" title={<>One more <span className="text-[#1c5960]">lock.</span></>} body="Add SecureID to your authenticator app. This keeps your account safe even when your password is not enough." step={4} total={4} /><div className="mt-9 grid gap-7 sm:grid-cols-[170px_1fr] sm:items-start"><div className="mx-auto grid h-40 w-40 place-items-center rounded-2xl border border-[#d0c9b9] bg-[#ebe8de] p-3 shadow-sm"><div className="qr-grid h-full w-full rounded-lg bg-[#18222e]" aria-label="Authenticator setup QR-style visual" data-testid="visual-qr"><div className="grid h-full grid-cols-9 grid-rows-9 gap-1 p-2 opacity-90">{Array.from({ length: 81 }, (_, index) => <span key={index} className={`${(index * 17 + index * index) % 5 < 2 ? 'bg-[#f5f3ed]' : 'bg-transparent'} rounded-[1px]`} />)}</div></div></div><div><p className="text-[13px] leading-5 text-[#6d7772]">Open your authenticator app and scan the setup visual. If you’re on the same device, use the manual key instead.</p><button type="button" onClick={() => setShowKey((value) => !value)} className="mt-4 inline-flex items-center gap-2 text-[12px] font-bold text-[#1c5960]" data-testid="button-toggle-setup-key"><KeyRound size={14} /> {showKey ? 'Hide setup key' : 'Show setup key'}</button>{showKey && <code className="mt-3 block rounded-lg bg-[#e9e6dd] px-3 py-2 font-mono text-[11px] tracking-[.15em] text-[#344a4a]" data-testid="text-setup-key">JBSW Y3DP EHPK 3PXP</code>}</div></div><form onSubmit={submit} className="mt-9"><label className="mb-3 block text-[12px] font-bold uppercase tracking-[.08em] text-[#596563]">6-digit authenticator code</label><OtpBoxes value={code} setValue={setCode} /><NoticeBox notice={notice} onDismiss={() => setNotice(null)} /><Button type="submit" className="mt-5 w-full">Confirm authenticator <ArrowRight size={17} /></Button><p className="mt-5 text-center text-[12px] text-[#7a817c]">You can add another device later from your account.</p></form></div></PageFrame>;
}

function Success() {
  const [, setLocation] = useLocation(); const registration = readRegistration();
  return <PageFrame><div className="w-full max-w-[510px] pt-8 text-center sm:pt-16"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#afd0bd] bg-[#e4f2e7] text-[#2f7859] animate-rise"><Check size={36} strokeWidth={2.5} /></div><div className="mt-9"><AuthTop eyebrow="all set / secureid" title={<>You’re <span className="text-[#1c5960]">in.</span></>} body={`Your identity is verified${registration?.firstName ? `, ${registration.firstName}` : ''}. Your SecureID account is ready whenever you are.`} /></div><div className="mt-10 flex flex-col gap-3"><Button type="button" onClick={() => setLocation('/login')} data-testid="button-go-login">Continue to sign in <ArrowRight size={17} /></Button><Link href="/" className="py-2 text-[13px] font-bold text-[#1c5960]" data-testid="link-success-home">Return home</Link></div></div></PageFrame>;
}

function Login() {
  const [, setLocation] = useLocation(); const login = useLogin(); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [notice, setNotice] = useState<Notice | null>(null); const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = (event: FormEvent) => { event.preventDefault(); const next: Record<string, string> = {}; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.'; if (!password) next.password = 'Enter your password.'; if (Object.keys(next).length) { setErrors(next); return; } setNotice(null); login.mutate({ data: { email, password } }, { onSuccess: (result) => { if (!result.success) { setNotice({ kind: 'error', text: result.message || 'The email or password is incorrect.' }); return; } setLocation('/dashboard'); }, onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'We could not sign you in. Check your details and try again.') }) }); };
  return <PageFrame><div className="w-full max-w-[470px] pt-4"><AuthTop eyebrow="secureid / sign in" title={<>Welcome <span className="text-[#1c5960]">back.</span></>} body="Sign in to manage your identity, devices, and verification settings." /><form onSubmit={submit} className="mt-10 space-y-5 animate-rise animate-rise-1"><Field label="Email address" id="login-email" type="email" value={email} onChange={setEmail} placeholder="you@domain.com" error={errors.email} autoComplete="email" /><div><Field label="Password" id="login-password" type={show ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="Your password" error={errors.password} autoComplete="current-password" trailing={<button type="button" onClick={() => setShow((value) => !value)} className="absolute right-3 top-3 p-1 text-[#6b7470]" aria-label={show ? 'Hide password' : 'Show password'} data-testid="button-toggle-login-password">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>} /><div className="mt-2 text-right"><Link href="/forgot-password" className="text-[12px] font-bold text-[#1c5960] hover:underline" data-testid="link-forgot-password">Forgot password?</Link></div></div><NoticeBox notice={notice} onDismiss={() => setNotice(null)} /><Button type="submit" className="w-full" disabled={login.isPending}>{login.isPending ? 'Signing you in…' : 'Sign in'} <ArrowRight size={17} /></Button><p className="text-center text-[13px] text-[#737b76]">New to SecureID? <Link href="/register" className="font-bold text-[#1c5960] hover:underline" data-testid="link-login-register">Create an account</Link></p></form></div></PageFrame>;
}

function ForgotPassword() {
  const [, setLocation] = useLocation(); const forgot = useForgotPassword(); const reset = useResetPassword(); const [stage, setStage] = useState<'request' | 'reset' | 'done'>('request'); const [email, setEmail] = useState(''); const [code, setCode] = useState(''); const [password, setPassword] = useState(''); const [show, setShow] = useState(false); const [notice, setNotice] = useState<Notice | null>(null);
  const request = (event: FormEvent) => { event.preventDefault(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setNotice({ kind: 'error', text: 'Enter the email address tied to your account.' }); return; } forgot.mutate({ data: { email } }, { onSuccess: (result) => { if (!result.success) { setNotice({ kind: 'error', text: result.message || 'We could not start the reset.' }); return; } setStage('reset'); setNotice({ kind: 'success', text: 'Reset instructions sent. Check your inbox for the six-digit code.' }); }, onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'We could not find that account.') }) }); };
  const submitReset = (event: FormEvent) => { event.preventDefault(); if (code.length !== 6 || password.length < 8) { setNotice({ kind: 'error', text: 'Enter a six-digit code and a password with at least 8 characters.' }); return; } reset.mutate({ data: { email, code, password } }, { onSuccess: (result) => { if (!result.success) { setNotice({ kind: 'error', text: result.message || 'That reset code was not accepted.' }); return; } setStage('done'); }, onError: (error) => setNotice({ kind: 'error', text: errorText(error, 'The code may be expired. Request a new one and try again.') }) }); };
  return <PageFrame><div className="w-full max-w-[510px]"><button type="button" onClick={() => stage === 'request' ? setLocation('/login') : setStage('request')} className="mb-12 inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.1em] text-[#6b7571] hover:text-[#1c5960]" data-testid="button-back-forgot"><ArrowLeft size={15} /> Back</button>{stage === 'done' ? <div className="pt-4 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-[#afd0bd] bg-[#e4f2e7] text-[#2f7859]"><Check size={36} /></div><div className="mt-8"><AuthTop eyebrow="password updated" title={<>New key, <span className="text-[#1c5960]">same you.</span></>} body="Your password has been updated. Use it to sign in to your SecureID account." /></div><Button className="mt-9 w-full" type="button" onClick={() => setLocation('/login')} data-testid="button-reset-login">Return to sign in <ArrowRight size={17} /></Button></div> : <><AuthTop eyebrow="account recovery" title={stage === 'request' ? <>Let’s get you <span className="text-[#1c5960]">back.</span></> : <>Set a new <span className="text-[#1c5960]">key.</span></>} body={stage === 'request' ? 'Enter your SecureID email and we’ll send a time-limited reset code.' : `Enter the code sent to ${maskEmail(email)}, then choose a new password.`} /><form onSubmit={stage === 'request' ? request : submitReset} className="mt-10 space-y-5">{stage === 'request' ? <Field label="Email address" id="reset-email" type="email" value={email} onChange={setEmail} placeholder="you@domain.com" autoComplete="email" /> : <><div><label className="mb-3 block text-[12px] font-bold uppercase tracking-[.08em] text-[#596563]">Reset code</label><OtpBoxes value={code} setValue={setCode} /></div><Field label="New password" id="new-password" type={show ? 'text' : 'password'} value={password} onChange={setPassword} placeholder="At least 8 characters" autoComplete="new-password" trailing={<button type="button" onClick={() => setShow((value) => !value)} className="absolute right-3 top-3 p-1 text-[#6b7470]" aria-label={show ? 'Hide password' : 'Show password'} data-testid="button-toggle-new-password">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>} /></>}<NoticeBox notice={notice} onDismiss={() => setNotice(null)} /><Button type="submit" className="w-full" disabled={forgot.isPending || reset.isPending}>{forgot.isPending || reset.isPending ? 'Working…' : stage === 'request' ? 'Send reset code' : 'Update password'} <ArrowRight size={17} /></Button></form></>}</div></PageFrame>;
}

function StatusChip({ label, verified }: { label: string; verified: boolean }) { return <div className="flex items-center justify-between rounded-xl border border-[#d9d4c8] bg-[#f8f6f0] px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#e8e4da] text-[#4b6662]">{label === 'Email' ? <Mail size={16} /> : <Smartphone size={16} />}</span><span className="text-[13px] font-semibold text-[#35433f]">{label}</span></div><span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.08em] ${verified ? 'text-[#397b61]' : 'text-[#a36a3e]'}`}><span className={`h-1.5 w-1.5 rounded-full ${verified ? 'bg-[#4d9b79]' : 'bg-[#d18a4b]'}`} />{verified ? 'verified' : 'pending'}</span></div>; }

function Dashboard() {
  const [, setLocation] = useLocation(); const me = useGetMe(); const logout = useLogout(); const [menu, setMenu] = useState(false);
  const user = me.data; const initials = user ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase() : '--';
  if (me.isLoading) return <div className="min-h-[100dvh] bg-[#f5f3ed] p-5 sm:p-10"><div className="mx-auto max-w-[1050px]"><div className="h-9 w-32 animate-pulse rounded-lg bg-[#e2ded3]" /><div className="mt-20 h-10 w-64 animate-pulse rounded-lg bg-[#e2ded3]" /><div className="mt-5 h-5 w-96 max-w-full animate-pulse rounded bg-[#e2ded3]" /></div></div>;
  if (me.isError || !user) return <div className="grid min-h-[100dvh] place-items-center bg-[#f5f3ed] px-5"><div className="max-w-md text-center"><CircleAlert className="mx-auto text-[#c65d4d]" size={35} /><h1 className="mt-5 font-mono text-2xl font-bold tracking-[-.05em]">Your session has ended.</h1><p className="mt-3 text-sm leading-6 text-[#717975]">Sign in again to access your protected account surface.</p><Link href="/login" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-xl bg-[#1c5960] px-6 text-sm font-bold text-[#fff8ec]" data-testid="link-session-login">Return to sign in <ArrowRight size={16} className="ml-2" /></Link></div></div>;
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { queryClient.clear(); setLocation('/'); } });
  return <div className="secure-noise min-h-[100dvh] bg-[#f5f3ed]"><header className="border-b border-[#ddd8cc] bg-[#f8f6f0]"><div className="mx-auto flex max-w-[1120px] items-center justify-between px-5 py-5 sm:px-8"><Logo /><div className="relative"><button type="button" onClick={() => setMenu((value) => !value)} className="flex items-center gap-3 rounded-xl p-1.5 pr-2 transition hover:bg-[#ebe8de]" data-testid="button-account-menu"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#1c5960] font-mono text-[12px] font-bold text-[#fff8ec]">{initials}</span><span className="hidden text-left sm:block"><span className="block text-[12px] font-bold text-[#27353b]">{user.firstName} {user.lastName}</span><span className="block text-[10px] text-[#7c847f]">personal account</span></span><ChevronRight size={15} className={`text-[#7c847f] transition ${menu ? 'rotate-90' : ''}`} /></button>{menu && <div className="absolute right-0 top-14 z-10 w-44 rounded-xl border border-[#d5d0c4] bg-[#fbfaf6] p-1.5 shadow-[0_12px_35px_rgba(26,38,48,.12)]"><button type="button" onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] font-semibold text-[#8b3f33] hover:bg-[#fff0eb]" data-testid="button-logout"><LogOut size={15} /> Sign out</button></div>}</div></div></header><main className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8 sm:py-16"><div className="max-w-[760px]"><div className="mb-5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.18em] text-[#1c5960]"><span className="h-2 w-2 rounded-full bg-[#75bda6]" /> protected account</div><h1 className="font-mono text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[.98] tracking-[-.09em] text-[#18222e]">Good to see you,<br /><span className="text-[#1c5960]" data-testid="text-dashboard-name">{user.firstName}.</span></h1><p className="mt-6 max-w-[550px] text-[16px] leading-7 text-[#6e7773]">This is your private account surface. Your identity is in good standing and your access is protected.</p></div><div className="mt-12 grid gap-4 lg:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-[#d7d1c4] bg-[#ebe8de] p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="font-mono text-[11px] font-bold uppercase tracking-[.15em] text-[#6c7772]">identity record</p><h2 className="mt-3 font-mono text-2xl font-bold tracking-[-.06em] text-[#18222e]" data-testid="text-user-name">{user.firstName} {user.lastName}</h2><p className="mt-1 text-[13px] text-[#727b76]" data-testid="text-user-email">{user.email}</p></div><div className="grid h-12 w-12 place-items-center rounded-xl bg-[#d1e1dc] text-[#1c5960]"><UserRound size={21} /></div></div><div className="mt-9 grid gap-3 sm:grid-cols-2"><StatusChip label="Email" verified={user.emailVerified} /><StatusChip label="Mobile" verified={user.mobileVerified} /></div></section><section className="rounded-2xl border border-[#d7d1c4] bg-[#f8f6f0] p-6 sm:p-8"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#dcebe5] text-[#397b61]"><LockKeyhole size={19} /></div><div><p className="font-mono text-[11px] font-bold uppercase tracking-[.12em] text-[#6c7772]">session</p><p className="mt-1 text-[14px] font-bold text-[#263a3a]" data-testid="status-session">active and encrypted</p></div></div><div className="mt-8 border-t border-[#ded9ce] pt-5 text-[12px] leading-5 text-[#737c77]"><p>Account created</p><p className="font-mono text-[#344643]" data-testid="text-created-at">{new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p></div><button type="button" onClick={signOut} disabled={logout.isPending} className="mt-6 inline-flex items-center gap-2 text-[12px] font-bold text-[#8b3f33] hover:underline" data-testid="button-logout-surface"><LogOut size={15} /> {logout.isPending ? 'Signing out…' : 'Sign out of SecureID'}</button></section></div></main></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/register" component={Register} /><Route path="/verify-email" component={() => <OtpPage type="email" />} /><Route path="/verify-mobile" component={() => <OtpPage type="mobile" />} /><Route path="/authenticator" component={Authenticator} /><Route path="/success" component={Success} /><Route path="/login" component={Login} /><Route path="/forgot-password" component={ForgotPassword} /><Route path="/dashboard" component={Dashboard} /><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;