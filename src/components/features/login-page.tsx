'use client';

import React, { useState } from 'react';
import { Calculator, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// SHA-256 hash of "baijing2026" — precomputed to avoid exposing plaintext
const PASSWORD_HASH = '4fce823d476baa44f62e83be32139ce612c6831c2ad0476412eb236aec82dc64';

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'eco_acc_auth';

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(SESSION_KEY) === '1';
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const hash = await sha256(password);
      if (hash === PASSWORD_HASH) {
        sessionStorage.setItem(SESSION_KEY, '1');
        onAuthenticated();
      } else {
        setError('密码错误，请重试');
      }
    } catch {
      setError('验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-800 text-white mb-4">
            <Calculator className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold text-slate-800">电商做账统计</h1>
          <p className="text-sm text-slate-500 mt-1">多平台数据管理工具</p>
        </div>

        {/* Login card */}
        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <Lock className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-700">请输入密码</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="输入访问密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                className="pr-10"
                autoFocus
                disabled={loading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-700 text-white"
              disabled={!password || loading}
            >
              {loading ? '验证中...' : '进入系统'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          团队共享工具 &middot; 请妥善保管密码
        </p>
      </div>
    </div>
  );
}
