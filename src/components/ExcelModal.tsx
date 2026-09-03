import React, { useState } from 'react';
import { X, FileSpreadsheet, Upload, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { InfoItem } from '../types';


interface ExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBulkInsert: (items: Array<Omit<InfoItem, 'id' | 'created_at'>>) => Promise<number>;
}

export const ExcelModal: React.FC<ExcelModalProps> = ({
  isOpen,
  onClose,
  onBulkInsert,
}) => {
  const [parsedData, setParsedData] = useState<Array<Omit<InfoItem, 'id' | 'created_at'>>>([]);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successCount, setSuccessCount] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    setFileName(file.name);
    setIsLoading(true);
    setErrorMsg('');
    setSuccessCount(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        throw new Error('엑셀 파일에 데이터가 비어있습니다.');
      }

      // Column mapping logic
      const mapped: Array<Omit<InfoItem, 'id' | 'created_at'>> = rows.map((row) => {
        // Keyword / Category
        const keyword = row['키워드'] || row['카테고리'] || row['대분류'] || row['category'] || '공통';
        // Keyword2 / Title
        const keyword2 = row['키워드2'] || row['제목'] || row['소분류'] || row['title'] || row['name'] || '';
        // Content
        const content = row['내용'] || row['본문'] || row['설명'] || row['content'] || row['description'] || '';
        // Images
        const images = row['이미지들'] || row['이미지'] || row['image_url'] || row['images'] || '';

        return {
          키워드: String(keyword).trim(),
          키워드2: String(keyword2).trim(),
          내용: String(content).trim(),
          이미지들: images ? String(images).trim() : null,
        };
      }).filter((item) => item.키워드2 || item.내용); // Must have title or content

      if (mapped.length === 0) {
        throw new Error('유효한 데이터 행을 찾을 수 없습니다. 컬럼명이 [키워드, 키워드2, 내용, 이미지들]인지 확인해주세요.');
      }

      setParsedData(mapped);
    } catch (err: any) {
      setErrorMsg(err.message || '엑셀 파일을 읽는 중 오류가 발생했습니다.');
      setParsedData([]);
    } finally {
      setIsLoading(false);
      e.target.value = '';
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        키워드: '공통',
        키워드2: '씨큐, 이모더 담당자 연락처',
        내용: '씨큐 오세준 010-2528-4652\n기타 문의: 카카오톡 채널',
        이미지들: 'https://example.com/sample1.png',
      },
      {
        키워드: '키오스크',
        키워드2: '삼성키오스크 화면 안나올 때 (검정화면)',
        내용: '키오스크 열고 영수증프린터 옆에 전원 버튼 5초간 길게 누름',
        이미지들: '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'info_데이터양식');
    XLSX.writeFile(wb, 'HanSearch_엑셀등록양식.xlsx');
  };

  const handleUploadToSupabase = async () => {
    if (parsedData.length === 0) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const insertedCount = await onBulkInsert(parsedData);
      setSuccessCount(insertedCount);
      setParsedData([]);
      setFileName('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Supabase 업로드 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
              <FileSpreadsheet size={18} className="stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800">엑셀 대량 업로드</h2>
              <p className="text-xs text-slate-500">
                엑셀 파일(.xlsx, .csv)을 등록하여 `info` 테이블에 일괄 추가합니다.
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Sample Download Bar */}
          <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-800">
            <span>
              💡 엑셀 컬럼: <strong>키워드</strong>(카테고리), <strong>키워드2</strong>(제목), <strong>내용</strong>, <strong>이미지들</strong>
            </span>
            <button
              onClick={handleDownloadSample}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
            >
              <Download size={13} />
              <span>샘플 양식 받기</span>
            </button>
          </div>

          {/* Error / Success feedback */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successCount !== null && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>총 <strong>{successCount}</strong>개의 데이터가 성공적으로 등록되었습니다!</span>
            </div>
          )}

          {/* Dropzone */}
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/20 rounded-2xl cursor-pointer transition-colors text-center">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
              className="hidden"
              disabled={isLoading || isSubmitting}
            />
            {isLoading ? (
              <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium py-4">
                <Loader2 size={20} className="animate-spin" />
                <span>엑셀 파일 분석 중...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Upload size={28} className="mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-700">
                  {fileName ? fileName : '엑셀 파일 선택 또는 드래그 앤 드롭'}
                </p>
                <p className="text-xs text-slate-500">
                  .xlsx, .xls, .csv 파일을 지원합니다.
                </p>
              </div>
            )}
          </label>

          {/* Preview Table */}
          {parsedData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-slate-700">
                  미리보기 ({parsedData.length}건 준비됨)
                </h3>
                <span className="text-[11px] text-slate-500">
                  상위 최대 5개 항목만 표시됩니다.
                </span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-100 font-bold text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">카테고리(키워드)</th>
                      <th className="px-3 py-2 text-left">제목(키워드2)</th>
                      <th className="px-3 py-2 text-left">내용</th>
                      <th className="px-3 py-2 text-left">이미지</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {parsedData.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-semibold text-blue-600">{row.키워드}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.키워드2}</td>
                        <td className="px-3 py-2 text-slate-600 truncate max-w-[200px]">{row.내용}</td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[100px]">{row.이미지들 || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleUploadToSupabase}
            disabled={parsedData.length === 0 || isSubmitting}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>DB에 대량 등록 중...</span>
              </>
            ) : (
              <span>{parsedData.length}건 일괄 등록하기</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
