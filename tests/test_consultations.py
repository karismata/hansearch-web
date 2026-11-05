"""Synthetic OpenXML fixtures only; never commit actual consultation exports."""
import importlib.util
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from xml.sax.saxutils import escape

spec = importlib.util.spec_from_file_location('consultation_server', Path(__file__).resolve().parents[1] / 'local-ai/server.py')
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


def workbook(path, rows=None, shared=False):
    rows = rows or [
        ['machine-key'], ['문의유형', '처리여부', '상담메모', '처리그룹', '처리내용'],
        ['장애', '처리완료', '포스 전원이 안켜져 어댑터 확인 문의', '가상담당자', '전원 연결 확인 후 점검 안내'],
        ['', '', '', '', '다른 상담에 연결하면 안되는 고아 처리내용'],
        ['장애', '완료', '포스 전원이 안켜짐 접수', '', '완료'],
        ['장애', '완료', '프린터 종이 공급 문제 발생', '', '용지 방향 확인 안내'],
    ]
    strings, sheet = [], []
    for n, row in enumerate(rows, 1):
        cells = []
        for c, value in enumerate(row):
            if shared:
                strings.append(value)
                cells.append(f'<c r="{chr(65+c)}{n}" t="s"><v>{len(strings)-1}</v></c>')
            else:
                cells.append(f'<c r="{chr(65+c)}{n}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
        sheet.append(f'<row r="{n}">{"".join(cells)}</row>')
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>')
        archive.writestr('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
        archive.writestr('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + ''.join(sheet) + '</sheetData></worksheet>')
        if shared:
            archive.writestr('xl/sharedStrings.xml', '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + ''.join('<si><t>' + escape(v) + '</t></si>' for v in strings) + '</sst>')


class ConsultationTests(unittest.TestCase):
    def setUp(self):
        server._consultation_cache = {}
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / '2026').mkdir()
        self.path = self.root / '2026/2026-10.xlsx'
        self.env = patch.dict(os.environ, {'CONSULTATION_DIR': str(self.root)})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_header_row_two_shared_strings_and_orphans(self):
        for shared in (True, False):
            workbook(self.path, shared=shared)
            rows, skipped = server.read_consultation_workbook(self.path, '2026/2026-10.xlsx')
            self.assertEqual([r['row'] for r in rows], [3, 6])
            self.assertEqual(skipped, 2)
            self.assertNotIn('가상담당자', json.dumps(rows, ensure_ascii=False))

    def test_replace_delete_and_corruption_remove_old_rows(self):
        workbook(self.path)
        self.assertEqual(server.sync_consultations()['count'], 2)
        with patch.object(server, 'read_consultation_workbook', side_effect=AssertionError('unchanged reparsed')):
            self.assertEqual(server.sync_consultations()['count'], 2)
        self.path.write_bytes(b'not a workbook')
        self.assertEqual(server.sync_consultations()['errors'], 1)
        self.assertEqual(server.find_consultations('포스 전원이 안켜져'), [])
        workbook(self.path)
        self.assertEqual(server.sync_consultations()['count'], 2)
        self.path.unlink()
        self.assertEqual(server.sync_consultations()['count'], 0)

    def test_months_deduplicate_and_reject_different_device_symptom(self):
        workbook(self.path)
        workbook(self.root / '2026/2026-11.xlsx')
        workbook(self.root / '2026/~$2026-12.xlsx')
        server.sync_consultations()
        matches = server.find_consultations('포스 전원이 안켜져')
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0]['row'], 3)
        self.assertEqual(server.find_consultations('키오스크 전원이 안켜져'), [])

    def test_redaction_and_external_query_isolation(self):
        redacted = server.redact_consultation('홍길동 사장님 010-1234-5678\n사업자번호: 123-45-67890\nTID=12345678\nabc@example.com https://example.invalid/customer')
        for private in ['홍길동', '010-1234-5678', '123-45-67890', '12345678', 'abc@example.com', 'example.invalid']:
            self.assertNotIn(private, redacted)
        workbook(self.path)
        server.sync_consultations()
        with patch.object(server, 'read_state', return_value={}), \
             patch.object(server, 'ollama_answer', return_value=json.dumps({'coverage': 'sufficient', 'summary': 'bad', 'source_ids': [], 'consultation_summary': '미검증 상담 참고: 전원 확인 기록이 있습니다.'})), \
             patch.object(server, 'web_search_answer', return_value={}) as web:
            result = server.search('포스 전원이 안켜져')
        self.assertEqual(result['coverage'], 'none')
        self.assertEqual(result['results'], [])
        self.assertIn('consultations', result)
        self.assertIn('미검증', result['consultation_summary'])
        web.assert_called_once_with('포스 전원이 안켜져', None)

    def test_barcode_aliases_generic_failure_and_unrelated_memos(self):
        server._consultation_cache = {'synthetic': {'rows': [
            {'source': '2026/2026-10.xlsx', 'sheet': 'Sheet1', 'row': 3, 'memo': '바코드 인식 불량으로 문의', 'action': '연결 상태 확인 안내'},
            {'source': '2026/2026-10.xlsx', 'sheet': 'Sheet1', 'row': 4, 'memo': '포스 프린터 종이 공급 불가 문의', 'action': '용지 장착 확인 안내'},
        ]}}
        for query in ('바코드기 정상작동 안됨', '바코드 리더기 정상 작동 안돼요', '스캐너 안됨'):
            self.assertEqual([row['row'] for row in server.find_consultations(query)], [3])
        self.assertEqual(server.find_consultations('정상작동 안됨'), [])

    def test_bad_headers_and_entities_rejected(self):
        workbook(self.path, [['상담메모 아님', '처리내용 아님']])
        self.assertEqual(server.sync_consultations()['errors'], 1)
        workbook(self.path)
        with zipfile.ZipFile(self.path, 'a') as archive:
            archive.writestr('xl/sharedStrings.xml', '<!DOCTYPE s [<!ENTITY bad "injected">]><sst/>')
        self.assertEqual(server.sync_consultations()['errors'], 1)


if __name__ == '__main__':
    unittest.main()
