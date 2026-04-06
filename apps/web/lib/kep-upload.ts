export function validateKepUpload(fileName?: string | null) {
  const name = String(fileName || '').toLowerCase();
  const ok = ['.cer', '.crt', '.sig', '.p7s', '.zip'].some((ext) => name.endsWith(ext));
  return {
    ok,
    message: ok ? 'Файл подходит для KЭП-контура' : 'Поддерживаются .cer, .crt, .sig, .p7s, .zip'
  };
}
