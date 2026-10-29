import catalog from '../../public/img/editorial/provenance.json';

export function editorialImage(topic: string, section = '') {
  const text = `${section} ${topic}`.toLowerCase();
  let id = 'construction-team-reviewing-plans';
  if (/cash|cost|profit|margin|account|invoice|billing|payment|retainage|wip|work.in.progress|payroll|budget|lien|financial/.test(text)) id = 'contractor-reviewing-invoices-and-job-costs';
  else if (/safety|osha|training|workforce|hiring|onboarding|crew|labor/.test(text)) id = 'construction-crew-safety-briefing';
  else if (/software|compare|digital|automation|technology|bim|rfi|submittal|inspection/.test(text)) id = 'project-engineer-using-field-tablet';
  else if (/licens|permit|\bcontracts?\b|compliance|regulation|policy/.test(text)) id = 'contractor-reviewing-permit-documents';
  else if (/equipment|material|supply|procurement|delivery|inventory|estimating|market-intelligence/.test(text)) id = 'construction-materials-delivery-inspection';
  const asset = catalog.find(a => a.id === id) ?? catalog[0];
  return { ...asset, src: `/img/editorial/${asset.id}.jpg`, webp: `/img/editorial/${asset.id}` };
}
