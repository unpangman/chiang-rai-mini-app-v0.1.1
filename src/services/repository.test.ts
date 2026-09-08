import { describe, expect, it } from 'vitest';
import { categoryTitle } from './repository';

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
