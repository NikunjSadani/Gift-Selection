import { deriveRetailerProgress } from '@/lib/retailer-progress';

const giftNameById = new Map<string, string>([
  ['g1', 'Prestige Mixer Grinder'],
  ['g2', 'Bajaj Iron'],
]);

describe('deriveRetailerProgress', () => {
  it('Submitted: a submission wins and shows its gift name', () => {
    const r = deriveRetailerProgress({ submission: { giftName: 'Prestige Mixer Grinder' }, draft: null, giftNameById });
    expect(r.status).toBe('Submitted');
    expect(r.giftSelected).toBe('Prestige Mixer Grinder');
  });

  it('Submitted with a null gift name → status Submitted, gift blank', () => {
    const r = deriveRetailerProgress({ submission: { giftName: null }, draft: null, giftNameById });
    expect(r.status).toBe('Submitted');
    expect(r.giftSelected).toBe('');
  });

  it('In Progress: draft has a gift picked but not submitted → resolves gift name', () => {
    const r = deriveRetailerProgress({ submission: null, draft: { giftId: 'g1', hasFormData: false }, giftNameById });
    expect(r.status).toBe('In Progress');
    expect(r.giftSelected).toBe('Prestige Mixer Grinder');
  });

  it('In Progress: draft gift id unknown → In Progress with blank gift', () => {
    const r = deriveRetailerProgress({ submission: null, draft: { giftId: 'gX', hasFormData: false }, giftNameById });
    expect(r.status).toBe('In Progress');
    expect(r.giftSelected).toBe('');
  });

  it('In Progress: form data started but no gift picked yet', () => {
    const r = deriveRetailerProgress({ submission: null, draft: { giftId: null, hasFormData: true }, giftNameById });
    expect(r.status).toBe('In Progress');
    expect(r.giftSelected).toBe('');
  });

  it('Not Started: an empty draft (no gift, no form data)', () => {
    const r = deriveRetailerProgress({ submission: null, draft: { giftId: null, hasFormData: false }, giftNameById });
    expect(r.status).toBe('Not Started');
    expect(r.giftSelected).toBe('');
  });

  it('Not Started: no submission and no draft at all', () => {
    const r = deriveRetailerProgress({ submission: null, draft: null, giftNameById });
    expect(r.status).toBe('Not Started');
    expect(r.giftSelected).toBe('');
  });
});
