import React, { useState, useEffect } from 'react';
import { X, Settings, Database, Key, HardDrive, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';
import type { SupabaseConfig } from '../types';
import { testConnection, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, DEFAULT_TABLE_NAME, DEFAULT_STORAGE_BUCKET } from '../lib/supabase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SupabaseConfig;
  onSaveConfig: (newConfig: SupabaseConfig) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<SupabaseConfig>(() => ({
    url: config.url || DEFAULT_SUPABASE_URL,
    anonKey: config.anonKey || DEFAULT_SUPABASE_ANON_KEY,
    tableName: config.tableName || DEFAULT_TABLE_NAME,
    storageBucket: config.storageBucket || DEFAULT_STORAGE_BUCKET,
  }));
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setFormData({
      url: config.url || DEFAULT_SUPABASE_URL,
      anonKey: config.anonKey || DEFAULT_SUPABASE_ANON_KEY,
      tableName: config.tableName || DEFAULT_TABLE_NAME,
      storageBucket: config.storageBucket || DEFAULT_STORAGE_BUCKET,
    });
  }, [config, isOpen]);


  if (!isOpen) return null;

  const handleChange = (field: keyof SupabaseConfig, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value.trim() }));
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await testConnection(formData);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, message: e.message || '연결 테스트 실패' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Settings size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">Supabase 연결 설정</h2>
              <p className="text-xs text-slate-500">
                데이터베이스 접속 URL 및 API 키를 입력하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {/* Info notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
            <Info size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">안내</p>
              <p>입력하신 정보는 브라우저 내부(LocalStorage)에 안전하게 저장되며, 외부 서버로 전송되지 않습니다.</p>
            </div>
          </div>

          {/* URL Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Database size={13} className="text-blue-500" />
              Supabase Project URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              placeholder="https://xxxxxxxx.supabase.co"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Anon Key Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Key size={13} className="text-amber-500" />
              Supabase Anon Public Key <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsIn..."
              value={formData.anonKey}
              onChange={(e) => handleChange('anonKey', e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Table Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Database size={13} className="text-emerald-500" />
                테이블 이름
              </label>
              <input
                type="text"
                placeholder="info"
                value={formData.tableName}
                onChange={(e) => handleChange('tableName', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Storage Bucket */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <HardDrive size={13} className="text-purple-500" />
                Storage 버킷명
              </label>
              <input
                type="text"
                placeholder="images"
                value={formData.storageBucket}
                onChange={(e) => handleChange('storageBucket', e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Test connection result */}
          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                testResult.success
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
              )}
              <span>{testResult.message}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting || !formData.url || !formData.anonKey}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isTesting ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>연결 테스트</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                닫기
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl transition-all shadow-sm"
              >
                저장 및 적용
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
