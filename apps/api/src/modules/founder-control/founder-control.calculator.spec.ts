import { calculateFounderControlOverview } from './founder-control.calculator';
import type { FounderControlRecordDto, FounderControlRecordType } from './founder-control.types';

function record(recordType: FounderControlRecordType, recordKey: string, payload: Record<string, unknown>): FounderControlRecordDto {
  return { id:`${recordType}:${recordKey}`,recordType,recordKey,payload,status:'ACTIVE',source:'TEST',version:'1',updatedAt:'2026-09-08T00:00:00.000Z' };
}
function evidence(key: string, gate: string, itemCode: string) {
  return record('EVIDENCE',key,{ gate,itemCode,required:true,status:'PASS',ref:`DOC-${key}`,verifiedBy:'reviewer',checkedAt:'2026-09-08T00:00:00.000Z' });
}
function fullEvidence(gate: 'LEGAL_LIVE'|'TAX_2PCT'|'TEAM'|'INFRA') {
  const requirements = {
    LEGAL_LIVE:['COMPANY_REGISTRATION','BANK_SIGNATORY','PAID_JOURNEY','INVOICE_SUPPORT_PROCESS'],
    TAX_2PCT:['TAMBOV_REGISTRATION','TECHNOPARK_RESIDENT','QUALIFYING_ACTIVITY','PROFILE_REVENUE_70'],
    TEAM:['DELIVERY_BACKUP_AGREEMENT','RESPONSIBILITY_HANDOVER'],
    INFRA:['CURRENT_INFRA_INVOICES'],
  } as const;
  return requirements[gate].map((itemCode,index)=>evidence(`${gate}-${index}`,gate,itemCode));
}
function cashWeeks() {
  return Array.from({length:13},(_,index)=>record('CASH_WEEK',`week-${index+1}`,{
    week:index+1,weekStart:new Date(Date.UTC(2026,8,7+index*7)).toISOString(),confirmedRecurringRub:0,launchPrepayRub:0,
    fundingDrawRub:0,corePayrollVendorsRub:0,clientVariableOnboardingRub:0,otherCommittedRub:0,
  }));
}
function client(key: string, group: string, pkg: 'Assisted'|'Self', proof=false, overrides: Record<string,unknown>={}) {
  const assisted=pkg==='Assisted';
  return record('CLIENT',key,{
    companyName:key,controlGroupId:group,package:pkg,status:'ACTIVE',goLive:'2026-09-08T00:00:00.000Z',
    mrrRub:assisted?120_000:60_000,launchFeeRub:assisted?180_000:90_000,launchPrepayPct:.7,paymentTermsDays:0,
    supportHours:assisted?10:4,engineerHours:assisted?2:1,otherDirectCostRub:0,benefitRubPerMonth:assisted?360_000:180_000,
    integrationFunded:'N/A',launchPrepayReceived:proof,paymentEvidenceRef:proof?`PAY-${key}`:'',repeatPaid:proof,
    lastPaidAt:proof?'2026-10-15T00:00:00.000Z':null,roiEvidence:proof,costMeasured:proof,
    actualLaunchCostRub:proof?(assisted?95_000:45_000):undefined,...overrides,
  });
}

describe('Founder Control calculator',()=>{
  const now=new Date('2026-09-08T12:00:00.000Z');

  it('fails closed with no company facts',()=>{
    const out=calculateFounderControlOverview([],now);
    expect(out.health).toBe('RED');
    expect(out.gates.scaleBudget).toBe('LOCKED');
    expect(out.metrics.cashOnBankRub).toBeNull();
    expect(out.alerts.some((a)=>a.id==='cash-evidence')).toBe(true);
    expect(out.workbookParity.length).toBeGreaterThan(35);
  });

  it('counts one proof for two clients under the same control group',()=>{
    const out=calculateFounderControlOverview([client('a','GROUP-1','Assisted',true),client('b','GROUP-1','Assisted',true)],now);
    expect(out.metrics.proofGroups).toBe(1);
  });

  it('calculates observed win rate from closed qualified opportunities only',()=>{
    const rows=[
      record('PIPELINE_OPPORTUNITY','won',{qualified:true,status:'WON',stage:'WON',mrrRub:120_000}),
      record('PIPELINE_OPPORTUNITY','lost',{qualified:true,status:'LOST',stage:'LOST',mrrRub:120_000}),
      ...Array.from({length:8},(_,i)=>record('PIPELINE_OPPORTUNITY',`open-${i}`,{qualified:true,status:'OPEN',stage:'QUALIFIED',mrrRub:120_000})),
    ];
    expect(calculateFounderControlOverview(rows,now).metrics.observedWinRate).toBe(.5);
  });

  it('blocks client economics when launch is loss-making',()=>{
    const out=calculateFounderControlOverview([client('a','G1','Assisted',false,{actualLaunchCostRub:250_000})],now);
    expect(out.health).not.toBe('GREEN');
    expect(out.metrics.proofGroups).toBe(0);
  });

  it('uses forecast override and flags negative M6 result',()=>{
    const rows=[record('FORECAST','period-6',{period:6,forecastMrrRub:480_000,forecastRecurringResultRub:-25_000,forecastClients:5,approvedAt:'2027-01-01T00:00:00.000Z',approvalEvidenceRef:'APP-1'})];
    const out=calculateFounderControlOverview(rows,now);
    expect(out.metrics.m6LatestMrrRub).toBe(480_000);
    expect(out.metrics.m6LatestRecurringResultRub).toBe(-25_000);
    expect(out.alerts.some((a)=>a.id==='forecast-m6-result'&&a.severity==='P0')).toBe(true);
  });

  it('does not let one evidence row close a multi-item legal gate',()=>{
    const out=calculateFounderControlOverview([evidence('legal-only','LEGAL_LIVE','COMPANY_REGISTRATION')],now);
    expect(out.gates.legalLive).toBe('EVIDENCE');
  });

  it('unlocks scale only on the complete operating path',()=>{
    const rows: FounderControlRecordDto[]=[
      record('CEO_INPUT','cashOnBankRub',{value:2_500_000}),record('CEO_INPUT','committedFundingRub',{value:0}),
      record('CEO_INPUT','infraMonthlyRub',{value:12_000}),record('CEO_INPUT','engineerHours',{value:80}),record('CEO_INPUT','supportHours',{value:80}),
      ...fullEvidence('LEGAL_LIVE'),...fullEvidence('TAX_2PCT'),...fullEvidence('TEAM'),...fullEvidence('INFRA'),...cashWeeks(),
    ];
    const clients=[
      client('a1','G1','Assisted',true),client('a2','G1','Assisted'),client('a3','G2','Assisted',true),client('a4','G2','Assisted'),
      client('a5','G3','Assisted'),client('a6','G3','Assisted'),client('a7','G4','Assisted'),client('s1','G4','Self'),client('s2','G4','Self'),
    ].map((entry)=>({...entry,payload:{...entry.payload,actualRecurringRevenueRub:Number(entry.payload.mrrRub),actualLaunchRevenueRub:0,actualSupportHours:Number(entry.payload.supportHours),actualEngineerHours:Number(entry.payload.engineerHours),actualOtherDirectCostRub:0,actualInfraAllocationRub:entry.recordKey==='a1'?12_000:0,pnlMonth:'2026-09-01T00:00:00.000Z'}}));
    const out=calculateFounderControlOverview([...rows,...clients],now);
    expect(out.metrics.activeAssisted).toBe(7); expect(out.metrics.activeSelf).toBe(2); expect(out.metrics.proofGroups).toBe(2);
    expect(out.gates.concentration).toBe('PASS'); expect(out.gates.infra).toBe('PASS'); expect(out.gates.runway).toBe('PASS');
    expect(out.gates.scaleBudget).toBe('UNLOCKED');
  });

  it('locks scale again when concentration exceeds 25%',()=>{
    const base: FounderControlRecordDto[]=[record('CEO_INPUT','cashOnBankRub',{value:2_500_000}),record('CEO_INPUT','infraMonthlyRub',{value:12_000}),...fullEvidence('LEGAL_LIVE'),...fullEvidence('TEAM'),...fullEvidence('INFRA'),...cashWeeks()];
    const clients=[client('a1','G1','Assisted',true),client('a2','G1','Assisted'),client('a3','G1','Assisted',true),client('a4','G2','Assisted'),client('a5','G2','Assisted'),client('a6','G3','Assisted'),client('a7','G4','Assisted'),client('s1','G4','Self'),client('s2','G4','Self')];
    const out=calculateFounderControlOverview([...base,...clients],now);
    expect(out.gates.concentration).toBe('BLOCK'); expect(out.gates.scaleBudget).toBe('LOCKED');
  });
});
