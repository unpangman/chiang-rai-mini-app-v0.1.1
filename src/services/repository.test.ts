import { describe, expect, it } from 'vitest';
import { categoryTitle, createComplaint } from './repository';

describe('categoryTitle', () => {
  it.each([
    ['streetlight', 'ปัญหาไฟสาธารณะ'],
    ['road', 'ปัญหาถนนชำรุด'],
    ['waste', 'ปัญหาขยะ'],
    ['flood', 'ปัญหาน้ำท่วม'],
    ['pm25', 'ปัญหา PM2.5'],
    ['information', 'คำขอข้อมูลข่าวสาร'],
    ['health', 'บริการด้านสุขภาพ']
  ])('maps %s to its public title', (category, title) => {
    expect(categoryTitle(category)).toBe(title);
  });

  it('uses a safe fallback for unknown categories', () => {
    expect(categoryTitle('unknown')).toBe('คำร้องทั่วไป');
  });
});

describe('createComplaint', () => {
  it.each(['information', 'health'] as const)('keeps %s out of the generic complaint workflow', async category => {
    await expect(createComplaint(
      { category, subtype: 'สอบถามบริการ', description: 'ทดสอบการแยกบริการ' },
      { userId: 'test-user', displayName: 'Test', isDemo: true }
    )).rejects.toThrow('บริการนี้ยังไม่เปิดรับผ่านแบบฟอร์มแจ้งปัญหาทั่วไป');
  });
});
